import { z } from "zod";
import { papelNoRelatorio } from "@/lib/acesso";
import { exigirUsuario, erroApi } from "@/lib/api-auth";
import { buscarTodos, inserir } from "@/lib/banco";
import type { Comentario } from "@/lib/equipe";
import { consumir, resposta429 } from "@/lib/limite-taxa";

type Ctx = { params: Promise<{ id: string }> };

const REGRA_COMENTAR = { limite: 60, janelaMs: 60 * 60_000 };

async function acesso(request: Request, ctx: Ctx) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return { resposta: auth.resposta } as const;
  const id = Number((await ctx.params).id);
  const papel = Number.isInteger(id) && id > 0 ? await papelNoRelatorio(auth.usuario.id, id) : null;
  if (!papel) return { resposta: erroApi("Relatório não encontrado.", "NAO_ENCONTRADO", 404) } as const;
  return { id, usuarioId: auth.usuario.id } as const;
}

async function listar(relatorioId: number, usuarioId: number): Promise<Comentario[]> {
  const linhas = await buscarTodos<{
    id: number;
    achado_ref: string | null;
    texto: string;
    autor: string;
    usuario_id: number;
    criado_em: unknown;
  }>(
    `SELECT c.id, c.achado_ref, c.texto, c.usuario_id, c.criado_em, u.nome AS autor
       FROM comentarios c JOIN usuarios u ON u.id = c.usuario_id
      WHERE c.relatorio_id = ? ORDER BY c.id`,
    relatorioId,
  );
  return linhas.map((l) => ({
    id: Number(l.id),
    achadoRef: l.achado_ref,
    texto: l.texto,
    autor: l.autor,
    meu: Number(l.usuario_id) === usuarioId,
    criadoEm: l.criado_em instanceof Date ? l.criado_em.toISOString() : String(l.criado_em ?? ""),
  }));
}

/** GET — comentários de revisão do relatório (dono e revisores). */
export async function GET(request: Request, ctx: Ctx) {
  const a = await acesso(request, ctx);
  if ("resposta" in a) return a.resposta;
  return Response.json(await listar(a.id, a.usuarioId));
}

const esquema = z.object({
  texto: z.string().trim().min(1, "Escreva o comentário.").max(2000),
  achadoRef: z
    .string()
    .trim()
    .max(30)
    .regex(/^[A-Za-z0-9_-]*$/)
    .optional()
    .transform((v) => v || null),
});

/** POST { texto, achadoRef? } — comenta o relatório ou um achado. */
export async function POST(request: Request, ctx: Ctx) {
  const a = await acesso(request, ctx);
  if ("resposta" in a) return a.resposta;
  const v = esquema.safeParse(await request.json().catch(() => null));
  if (!v.success) return erroApi(v.error.issues[0]?.message ?? "Comentário inválido.", "VALIDACAO", 400);

  const bloqueio = consumir(`comentar:${a.usuarioId}`, REGRA_COMENTAR);
  if (bloqueio) return resposta429(bloqueio);

  await inserir(
    "INSERT INTO comentarios (relatorio_id, achado_ref, usuario_id, texto) VALUES (?, ?, ?, ?)",
    a.id,
    v.data.achadoRef,
    a.usuarioId,
    v.data.texto,
  );
  return Response.json(await listar(a.id, a.usuarioId), { status: 201 });
}

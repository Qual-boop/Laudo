import { z } from "zod";
import { LIMITE_COLEGAS, papelNoRelatorio } from "@/lib/acesso";
import { exigirUsuario, erroApi } from "@/lib/api-auth";
import { buscarTodos, buscarUm, executar } from "@/lib/banco";
import { consumir, resposta429 } from "@/lib/limite-taxa";
import { normalizarPlano } from "@/lib/planos";
import { buscarUsuarioPorEmail } from "@/lib/usuarios";

type Ctx = { params: Promise<{ id: string }> };

const REGRA_COMPARTILHAR = { limite: 30, janelaMs: 60 * 60_000 };

/** Mesma resposta exista ou não a conta: compartilhar não vira enumeração de e-mails. */
const MENSAGEM_ENVIO =
  "Se houver uma conta Provafix com esse e-mail, ela já tem acesso de revisão a este relatório.";

async function relatorioId(ctx: Ctx): Promise<number | null> {
  const n = Number((await ctx.params).id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function membros(id: number, comEmail: boolean) {
  const linhas = await buscarTodos<{ id: number; nome: string; email: string; papel: string; criado_em: unknown }>(
    `SELECT u.id, u.nome, u.email, c.papel, c.criado_em
       FROM compartilhamentos c JOIN usuarios u ON u.id = c.usuario_id
      WHERE c.relatorio_id = ? ORDER BY c.criado_em, u.id`,
    id,
  );
  return linhas.map((l) => ({
    id: Number(l.id),
    nome: l.nome,
    email: comEmail ? l.email : undefined,
    papel: l.papel,
  }));
}

/** GET — quem tem acesso (dono vê e-mails; revisor vê nomes). */
export async function GET(request: Request, ctx: Ctx) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;
  const id = await relatorioId(ctx);
  const papel = id ? await papelNoRelatorio(auth.usuario.id, id) : null;
  if (!id || !papel) return erroApi("Relatório não encontrado.", "NAO_ENCONTRADO", 404);

  const dono = await buscarUm<{ nome: string }>(
    "SELECT u.nome FROM relatorios r JOIN usuarios u ON u.id = r.usuario_id WHERE r.id = ?",
    id,
  );
  return Response.json({
    papel,
    dono: dono?.nome ?? "",
    membros: await membros(id, papel === "dono"),
    limite: LIMITE_COLEGAS[normalizarPlano(auth.usuario.plano)],
  });
}

const esquemaPost = z.object({ email: z.string().trim().toLowerCase().email().max(254) });

/** POST { email } — o dono dá acesso de revisão a um colega. */
export async function POST(request: Request, ctx: Ctx) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;
  const id = await relatorioId(ctx);
  const papel = id ? await papelNoRelatorio(auth.usuario.id, id) : null;
  if (!id || !papel) return erroApi("Relatório não encontrado.", "NAO_ENCONTRADO", 404);
  if (papel !== "dono") return erroApi("Só o dono do relatório compartilha.", "ACESSO_NEGADO", 403);

  const v = esquemaPost.safeParse(await request.json().catch(() => null));
  if (!v.success) return erroApi("Informe um e-mail válido.", "VALIDACAO", 400);

  const limite = LIMITE_COLEGAS[normalizarPlano(auth.usuario.plano)];
  if (limite === 0) {
    return erroApi(
      "Compartilhar relatórios é dos planos Pro (1 colega por relatório) e Team (até 10).",
      "PLANO_INSUFICIENTE",
      402,
    );
  }

  const bloqueio = consumir(`compartilhar:${auth.usuario.id}`, REGRA_COMPARTILHAR);
  if (bloqueio) return resposta429(bloqueio);

  const atuais = await buscarUm<{ n: number }>(
    "SELECT COUNT(*) AS n FROM compartilhamentos WHERE relatorio_id = ?",
    id,
  );
  if (Number(atuais?.n ?? 0) >= limite) {
    return erroApi(
      `Seu plano permite ${limite} colega${limite === 1 ? "" : "s"} por relatório. Remova alguém ou faça upgrade.`,
      "LIMITE_PLANO",
      409,
    );
  }

  const colega = await buscarUsuarioPorEmail(v.data.email);
  if (colega && colega.id !== auth.usuario.id) {
    await executar(
      `INSERT INTO compartilhamentos (relatorio_id, usuario_id, papel) VALUES (?, ?, 'revisor')
       ON CONFLICT (relatorio_id, usuario_id) DO NOTHING`,
      id,
      colega.id,
    );
  }
  return Response.json({ mensagem: MENSAGEM_ENVIO, membros: await membros(id, true) });
}

/** DELETE ?usuarioId=ID — o dono remove alguém; o revisor pode sair. */
export async function DELETE(request: Request, ctx: Ctx) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;
  const id = await relatorioId(ctx);
  const papel = id ? await papelNoRelatorio(auth.usuario.id, id) : null;
  if (!id || !papel) return erroApi("Relatório não encontrado.", "NAO_ENCONTRADO", 404);

  const alvo = Number(new URL(request.url).searchParams.get("usuarioId"));
  if (!Number.isInteger(alvo) || alvo <= 0) return erroApi("Informe quem remover.", "VALIDACAO", 400);
  if (papel !== "dono" && alvo !== auth.usuario.id) {
    return erroApi("Só o dono remove outros colegas.", "ACESSO_NEGADO", 403);
  }
  await executar("DELETE FROM compartilhamentos WHERE relatorio_id = ? AND usuario_id = ?", id, alvo);
  return new Response(null, { status: 204 });
}

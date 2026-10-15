import db from "@/lib/db";
import { exigirUsuario, erroApi } from "@/lib/api-auth";
import {
  gerarExportacaoGitHub,
  gerarExportacaoJira,
  gerarExportacaoTexto,
} from "@/lib/exportacao";
import { LIMITES } from "@/lib/planos";
import { esquemaId, validar } from "@/lib/validacao";
import type { Relatorio } from "@/lib/tipos";

const FORMATOS = ["markdown", "json", "texto"] as const;
type Formato = (typeof FORMATOS)[number];

/**
 * GET /api/v1/relatorios/[id]/export?formato=markdown|json|texto
 * Exporta o relatório inteiro. Jira/GitHub exigem plano pago (free: só texto).
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  const { id: bruto } = await ctx.params;
  const v = validar(esquemaId, bruto);
  if (!v.ok) return v.resposta;

  const formato = new URL(request.url).searchParams.get("formato") ?? "markdown";
  if (!(FORMATOS as readonly string[]).includes(formato)) {
    return erroApi(
      `formato inválido. Use: ${FORMATOS.join(", ")}.`,
      "FORMATO_INVALIDO",
      400,
    );
  }

  const linha = db
    .prepare("SELECT relatorio_json, usuario_id FROM relatorios WHERE id = ?")
    .get(v.dados) as
    | { relatorio_json: string; usuario_id: number | null }
    | undefined;

  if (!linha) {
    return erroApi("Relatório não encontrado.", "NAO_ENCONTRADO", 404);
  }
  // Fail-closed: relatório sem dono (legado) não exporta para ninguém.
  if (linha.usuario_id !== auth.usuario.id) {
    return erroApi("Acesso negado a este relatório.", "ACESSO_NEGADO", 403);
  }

  let relatorio: Relatorio;
  try {
    relatorio = JSON.parse(linha.relatorio_json) as Relatorio;
  } catch {
    return erroApi("Relatório corrompido no banco.", "DADO_CORROMPIDO", 500);
  }

  if (
    (formato === "markdown" || formato === "json") &&
    !LIMITES[auth.usuario.plano].exportacaoAvancada
  ) {
    return Response.json(
      {
        error: "Exportação Jira/GitHub disponível nos planos Pro e Team.",
        code: "LIMITE_PLANO",
        recurso: "exportacao",
        plano: auth.usuario.plano,
      },
      { status: 402 },
    );
  }

  if (formato === "json") {
    return Response.json(gerarExportacaoGitHub(relatorio));
  }
  if (formato === "texto") {
    return new Response(gerarExportacaoTexto(relatorio), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const jira = gerarExportacaoJira(relatorio);
  return new Response(
    `${jira.summary}\n\n${jira.description}\n\nlabels: ${jira.labels.join(", ")}`,
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}

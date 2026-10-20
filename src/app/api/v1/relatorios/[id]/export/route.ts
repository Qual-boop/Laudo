import { buscarUm } from "@/lib/banco";
import { exigirUsuario, erroApi } from "@/lib/api-auth";
import {
  gerarExportacaoGitHub,
  gerarExportacaoJira,
  gerarExportacaoTexto,
} from "@/lib/exportacao";
import { gerarCsv } from "@/lib/csv";
import { carregarDocumento } from "@/lib/documento";
import { nomeArquivo } from "@/lib/documento-formato";
import { LIMITES } from "@/lib/planos";
import { esquemaId, validar } from "@/lib/validacao";
import type { Relatorio } from "@/lib/tipos";

const FORMATOS = ["markdown", "json", "texto", "csv"] as const;
type Formato = (typeof FORMATOS)[number];

/**
 * GET /api/v1/relatorios/[id]/export?formato=markdown|json|texto|csv
 * Exporta o relatório inteiro. Jira/GitHub/CSV exigem plano pago (free: só
 * texto). O CSV sai como download (planilha de acompanhamento dos achados).
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

  const linha = await buscarUm<{ relatorio_json: string; usuario_id: number | null }>(
    "SELECT relatorio_json, usuario_id FROM relatorios WHERE id = ?",
    v.dados,
  );

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
    (formato === "markdown" || formato === "json" || formato === "csv") &&
    !LIMITES[auth.usuario.plano].exportacaoAvancada
  ) {
    return Response.json(
      {
        error: "Exportação Jira/GitHub/CSV disponível nos planos Pro e Team.",
        code: "LIMITE_PLANO",
        recurso: "exportacao",
        plano: auth.usuario.plano,
      },
      { status: 402 },
    );
  }

  if (formato === "csv") {
    const doc = await carregarDocumento(v.dados);
    if (!doc) return erroApi("Relatório corrompido no banco.", "DADO_CORROMPIDO", 500);
    const arquivo = `${nomeArquivo("Achados", doc.relatorio.capa.cliente, doc.relatorio.capa.data)}.csv`;
    return new Response(gerarCsv(doc), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${arquivo}"`,
        "Cache-Control": "no-store",
      },
    });
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

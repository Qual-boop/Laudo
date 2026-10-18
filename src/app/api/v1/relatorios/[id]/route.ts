import { papelNoRelatorio } from "@/lib/acesso";
import { buscarUm } from "@/lib/banco";
import { exigirUsuario, erroApi } from "@/lib/api-auth";
import { esquemaId, validar } from "@/lib/validacao";

/** GET /api/v1/relatorios/[id] — devolve o relatório ao dono e aos revisores. */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  const { id: bruto } = await ctx.params;
  const v = validar(esquemaId, bruto);
  if (!v.ok) return v.resposta;

  const linha = await buscarUm<{ relatorio_json: string }>(
    "SELECT relatorio_json FROM relatorios WHERE id = ?",
    v.dados,
  );

  if (!linha) {
    return erroApi("Relatório não encontrado.", "NAO_ENCONTRADO", 404);
  }

  // Fail-closed: relatório sem dono (legado) não abre para ninguém
  // (papelNoRelatorio devolve null). Revisor lê; só o dono altera.
  if (!(await papelNoRelatorio(auth.usuario.id, v.dados))) {
    return erroApi("Acesso negado a este relatório.", "ACESSO_NEGADO", 403);
  }

  try {
    return Response.json(JSON.parse(linha.relatorio_json));
  } catch {
    return erroApi("Relatório corrompido no banco.", "DADO_CORROMPIDO", 500);
  }
}

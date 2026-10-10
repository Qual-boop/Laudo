import db from "@/lib/db";
import { exigirUsuario, erroApi } from "@/lib/api-auth";
import { esquemaId, validar } from "@/lib/validacao";

/** GET /api/v1/relatorios/[id] — devolve o relatório SÓ se for do usuário. */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  const { id: bruto } = await ctx.params;
  const v = validar(esquemaId, bruto);
  if (!v.ok) return v.resposta;

  const linha = db
    .prepare("SELECT relatorio_json, usuario_id FROM relatorios WHERE id = ?")
    .get(v.dados) as
    | { relatorio_json: string; usuario_id: number | null }
    | undefined;

  if (!linha) {
    return erroApi("Relatório não encontrado.", "NAO_ENCONTRADO", 404);
  }

  // Relatórios antigos (antes do multi-usuário) não têm dono.
  if (linha.usuario_id !== null && linha.usuario_id !== auth.usuario.id) {
    return erroApi("Acesso negado a este relatório.", "ACESSO_NEGADO", 403);
  }

  try {
    return Response.json(JSON.parse(linha.relatorio_json));
  } catch {
    return erroApi("Relatório corrompido no banco.", "DADO_CORROMPIDO", 500);
  }
}

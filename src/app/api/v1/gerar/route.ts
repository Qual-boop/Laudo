import { exigirUsuario, erroApi } from "@/lib/api-auth";
import { gerarRelatorio } from "@/lib/ia";
import { esquemaGerar, validar } from "@/lib/validacao";

/** POST /api/v1/gerar — gera relatório via IA (ou fallback local). */
export async function POST(request: Request) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return erroApi("Corpo da requisição inválido.", "JSON_INVALIDO", 400);
  }

  const v = validar(esquemaGerar, corpo);
  if (!v.ok) return v.resposta;

  return Response.json(await gerarRelatorio(v.dados));
}

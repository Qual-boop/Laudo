import { exigirUsuario, erroApi } from "@/lib/api-auth";
import { EscudoPrivacidade } from "@/lib/anonimizacao";
import { gerarRelatorio } from "@/lib/ia";
import { REGRAS, consumir, resposta429 } from "@/lib/limite-taxa";
import {
  consumirUso,
  devolverUso,
  lerUso,
  respostaLimite,
  verificarLimite,
} from "@/lib/limites";
import { normalizarPlano } from "@/lib/planos";
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

  const plano = normalizarPlano(auth.usuario.plano);

  // Rajada: a cota mensal limita o total; isto segura um script que
  // queimaria a cota (e os tokens pagos) em minutos.
  const rajada = consumir(`gerar:usuario:${auth.usuario.id}`, REGRAS.gerarUsuario);
  if (rajada) return resposta429(rajada);

  // Sem cota de relatórios não adianta gerar (não daria para salvar).
  const relatorios = verificarLimite(plano, await lerUso(auth.usuario.id), "relatorios");
  if (!relatorios.permitido) return respostaLimite(relatorios, plano);

  // Cada geração gasta IA paga: consome a cota de gerações (atômico).
  const geracoes = await consumirUso(auth.usuario.id, plano, "geracoes");
  if (!geracoes.permitido) return respostaLimite(geracoes, plano);

  // Escudo de privacidade: a IA só vê marcadores; os dados reais voltam
  // aqui, depois da resposta. A tabela de troca morre com a requisição.
  const escudo = new EscudoPrivacidade([v.dados.cliente]);
  let relatorio: Awaited<ReturnType<typeof gerarRelatorio>>;
  try {
    relatorio = escudo.restaurar(await gerarRelatorio(escudo.anonimizar(v.dados)));
  } catch (e) {
    await devolverUso(auth.usuario.id, "geracoes");
    throw e;
  }

  return Response.json(relatorio, {
    headers: { "X-Laudo-Protegidos": escudo.cabecalho() },
  });
}

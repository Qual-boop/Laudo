import { exigirUsuario } from "@/lib/api-auth";
import { LIMITES, mesAtual, obterUso } from "@/lib/limites";

/** GET /api/v1/uso — plano + consumo do mês (contadores do dashboard). */
export async function GET(request: Request) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  const uso = await obterUso(auth.usuario.id);
  const limites = LIMITES[auth.usuario.plano];

  return Response.json({
    plano: auth.usuario.plano,
    mes: mesAtual(),
    relatorios: { usados: uso.relatorios_criados, limite: limites.relatoriosMes },
    retestes: { usados: uso.retestes_registrados, limite: limites.retestesMes },
    geracoes: { usados: uso.geracoes_ia, limite: limites.geracoesIaMes },
    achadosPorRelatorio: limites.achadosPorRelatorio,
    exportacaoAvancada: limites.exportacaoAvancada,
    certificado: limites.certificado,
  });
}

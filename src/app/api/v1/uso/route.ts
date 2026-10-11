import { exigirUsuario } from "@/lib/api-auth";
import { LIMITES, obterUso } from "@/lib/limites";

/** GET /api/v1/uso — plano + consumo do mês (contadores do dashboard). */
export async function GET(request: Request) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  const uso = obterUso(auth.usuario.id);
  const limites = LIMITES[auth.usuario.plano];

  return Response.json({
    plano: auth.usuario.plano,
    mes: new Date().toISOString().slice(0, 7),
    relatorios: { usados: uso.relatorios_criados, limite: limites.relatoriosMes },
    retestes: { usados: uso.retestes_registrados, limite: limites.retestesMes },
    achadosPorRelatorio: limites.achadosPorRelatorio,
    exportacaoAvancada: limites.exportacaoAvancada,
    certificado: limites.certificado,
  });
}

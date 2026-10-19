import { buscarUm, executar } from "@/lib/banco";
import { exigirUsuario, erroApi } from "@/lib/api-auth";
import { cancelarAssinatura } from "@/lib/asaas";

/**
 * POST /api/v1/assinatura/cancelar — cancela a renovação no Asaas; o
 * plano segue até o fim do período pago e então volta para free. (O Asaas
 * não tem Customer Portal; o cancelamento é via API.)
 */
export async function POST(request: Request) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  const u = await buscarUm<{ asaas_subscription_id: string | null }>(
    "SELECT asaas_subscription_id FROM usuarios WHERE id = ?",
    auth.usuario.id,
  );

  if (!u?.asaas_subscription_id) {
    return erroApi("Sem assinatura para cancelar.", "SEM_ASSINATURA", 409);
  }

  try {
    await cancelarAssinatura(u.asaas_subscription_id);
  } catch (e) {
    // 404 no Asaas = já cancelada/removida por lá: só limpa local.
    if ((e as { status?: number }).status !== 404) {
      const msg = e instanceof Error ? e.message : String(e);
      return erroApi(msg || "Falha ao cancelar.", "CANCELAMENTO_FALHOU", 502);
    }
  }

  // O período já pago continua valendo até plano_expira_em (o downgrade
  // preguiçoso de assinaturaDe zera na data). Antes o cancelamento tirava o
  // plano na hora — o cliente perdia dias pelos quais já tinha pago.
  await executar(
    `UPDATE usuarios SET asaas_subscription_id = NULL, assinatura_plano = NULL,
      assinatura_status = 'cancelada',
      atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`,
    auth.usuario.id,
  );

  const atual = await buscarUm<{ plano: string; plano_expira_em: string | null }>(
    "SELECT plano, plano_expira_em FROM usuarios WHERE id = ?",
    auth.usuario.id,
  );
  return Response.json({
    ok: true,
    plano: atual?.plano ?? "free",
    acessoAte: atual?.plano_expira_em ?? null,
  });
}

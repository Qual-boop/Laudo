import { buscarUm, executar } from "@/lib/banco";
import { exigirUsuario, erroApi } from "@/lib/api-auth";
import { cancelarNoFimDoPeriodo } from "@/lib/stripe";

/**
 * POST /api/v1/assinatura/cancelar — cancela a renovação no Stripe; o
 * plano segue até o fim do período pago e então volta para free (o
 * webhook customer.subscription.deleted chega nessa data).
 */
export async function POST(request: Request) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  const u = await buscarUm<{ stripe_subscription_id: string | null }>(
    "SELECT stripe_subscription_id FROM usuarios WHERE id = ?",
    auth.usuario.id,
  );

  if (!u?.stripe_subscription_id) {
    return erroApi("Sem assinatura para cancelar.", "SEM_ASSINATURA", 409);
  }

  try {
    await cancelarNoFimDoPeriodo(u.stripe_subscription_id);
  } catch (e) {
    // 404 no Stripe = já não existe por lá: só limpa local.
    if ((e as { status?: number }).status !== 404) {
      const msg = e instanceof Error ? e.message : String(e);
      return erroApi(msg || "Falha ao cancelar.", "CANCELAMENTO_FALHOU", 502);
    }
    await executar(
      "UPDATE usuarios SET stripe_subscription_id = NULL, assinatura_plano = NULL WHERE id = ?",
      auth.usuario.id,
    );
  }

  await executar(
    `UPDATE usuarios SET assinatura_status = 'cancelada',
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

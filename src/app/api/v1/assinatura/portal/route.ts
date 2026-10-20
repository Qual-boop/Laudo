import { buscarUm } from "@/lib/banco";
import { exigirUsuario, erroApi } from "@/lib/api-auth";
import { URL_SITE } from "@/lib/site";
import { criarPortal, stripeConfigurado } from "@/lib/stripe";

/**
 * POST /api/v1/assinatura/portal — abre o portal do cliente do Stripe
 * (trocar cartão, baixar faturas, trocar de plano, cancelar ou reativar).
 */
export async function POST(request: Request) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  if (!stripeConfigurado()) {
    return erroApi("Pagamentos ainda não estão disponíveis.", "PAGAMENTO_INDISPONIVEL", 503);
  }

  const u = await buscarUm<{ stripe_customer_id: string | null }>(
    "SELECT stripe_customer_id FROM usuarios WHERE id = ?",
    auth.usuario.id,
  );
  if (!u?.stripe_customer_id) {
    return erroApi("Você ainda não tem assinatura.", "SEM_ASSINATURA", 409);
  }

  try {
    const portal = await criarPortal(u.stripe_customer_id, `${URL_SITE}/perfil`);
    return Response.json({ url: portal.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return erroApi(msg || "Portal indisponível.", "PORTAL_FALHOU", 502);
  }
}

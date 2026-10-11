import db from "@/lib/db";
import { exigirUsuario, erroApi } from "@/lib/api-auth";
import { stripe } from "@/lib/assinatura";

/**
 * POST /api/v1/portal — sessão do Stripe Customer Portal
 * (gerenciar assinatura, ver faturas, trocar cartão).
 */
export async function POST(request: Request) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  const s = stripe();
  if (!s) {
    return erroApi("Portal indisponível: Stripe não configurado.", "STRIPE_AUSENTE", 500);
  }

  const u = db
    .prepare("SELECT stripe_customer_id FROM usuarios WHERE id = ?")
    .get(auth.usuario.id) as { stripe_customer_id: string | null };

  if (!u?.stripe_customer_id) {
    return erroApi("Sem assinatura para gerenciar. Assine um plano primeiro.", "SEM_ASSINATURA", 409);
  }

  const base = new URL(request.url).origin;
  const sessao = await s.billingPortal.sessions.create({
    customer: u.stripe_customer_id,
    return_url: `${base}/perfil`,
  });

  return Response.json({ url: sessao.url });
}

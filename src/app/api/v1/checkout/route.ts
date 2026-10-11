import { exigirUsuario, erroApi } from "@/lib/api-auth";
import { precoPara, stripe, type Periodo, type PlanoPago } from "@/lib/assinatura";

/**
 * POST /api/v1/checkout — cria sessão do Stripe Checkout.
 * Body: { plano: "pro" | "team", periodo: "mensal" | "anual" }.
 * Devolve { url } para redirecionar o browser.
 */
export async function POST(request: Request) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return erroApi("Corpo da requisição inválido.", "JSON_INVALIDO", 400);
  }

  const b = (corpo ?? {}) as Record<string, unknown>;
  const plano = b.plano as PlanoPago;
  const periodo = (b.periodo ?? "mensal") as Periodo;

  if (plano !== "pro" && plano !== "team") {
    return erroApi("plano deve ser pro ou team.", "VALIDACAO", 400);
  }
  if (periodo !== "mensal" && periodo !== "anual") {
    return erroApi("periodo deve ser mensal ou anual.", "VALIDACAO", 400);
  }

  const s = stripe();
  if (!s) {
    return erroApi(
      "Checkout indisponível: STRIPE_SECRET_KEY não configurada.",
      "STRIPE_AUSENTE",
      500,
    );
  }

  const price = precoPara(plano, periodo);
  if (!price) {
    return erroApi(
      "Price ID do Stripe não configurado para este plano.",
      "STRIPE_PRECO_AUSENTE",
      500,
    );
  }

  const base = new URL(request.url).origin;
  const sessao = await s.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    customer_email: auth.usuario.email,
    success_url: `${base}/perfil?assinatura=ok`,
    cancel_url: `${base}/precos?assinatura=cancelada`,
    metadata: { usuarioId: String(auth.usuario.id), plano },
  });

  return Response.json({ url: sessao.url });
}

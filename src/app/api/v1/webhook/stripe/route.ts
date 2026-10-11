import { aplicarEventoWebhook, stripe } from "@/lib/assinatura";

/**
 * POST /api/v1/webhook/stripe — eventos do Stripe (assinaturas).
 * Pública por necessidade (o Stripe chama sem JWT); autenticada pela
 * assinatura HMAC do corpo (STRIPE_WEBHOOK_SECRET). Lê o corpo cru:
 * nenhum parse JSON antes da verificação.
 */
export async function POST(request: Request) {
  const s = stripe();
  const segredo = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !segredo) {
    return Response.json(
      { error: "Webhook indisponível no servidor.", code: "STRIPE_AUSENTE" },
      { status: 500 },
    );
  }

  const assinatura = request.headers.get("stripe-signature");
  if (!assinatura) {
    return Response.json(
      { error: "Assinatura do webhook ausente.", code: "WEBHOOK_SEM_ASSINATURA" },
      { status: 400 },
    );
  }

  let evento: { type: string; data: { object: Record<string, unknown> } };
  try {
    const corpo = await request.text();
    evento = s.webhooks.constructEvent(corpo, assinatura, segredo) as unknown as {
      type: string;
      data: { object: Record<string, unknown> };
    };
  } catch {
    return Response.json(
      { error: "Assinatura do webhook inválida.", code: "WEBHOOK_INVALIDO" },
      { status: 400 },
    );
  }

  const r = aplicarEventoWebhook(evento);
  if (!r.ok) {
    return Response.json(
      { error: "Evento não aplicado.", code: "WEBHOOK_NAO_APLICADO" },
      { status: 422 },
    );
  }
  return Response.json({ ok: true });
}

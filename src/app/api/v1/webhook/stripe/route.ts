import { aplicarEventoStripe, type EventoStripe } from "@/lib/assinatura";
import { assinaturaWebhookValida } from "@/lib/stripe";

/**
 * POST /api/v1/webhook/stripe — eventos de assinatura do Stripe.
 * Pública por necessidade (o Stripe chama sem sessão).
 *
 * Autenticidade: cabeçalho `Stripe-Signature` conferido com
 * STRIPE_WEBHOOK_SECRET sobre o corpo BRUTO (por isso `request.text()`,
 * nunca `json()` antes). Sem segredo configurado, recusa em produção.
 *
 * Respostas: 400 para assinatura inválida/JSON quebrado (o Stripe mostra
 * no painel), 200 para processado ou ignorado, 500 se o efeito falhar —
 * o Stripe reenvia, e a idempotência (webhook_eventos na mesma transação
 * do efeito) garante que nada é aplicado duas vezes.
 */
function registrar(dados: { id?: string; tipo?: string; aplicado: boolean; motivo?: string }) {
  // Só identificadores e resultado: o payload traz e-mail/nome do cliente.
  console.info(
    JSON.stringify({
      webhook: "stripe",
      ...dados,
      id: dados.id?.slice(0, 100),
      tipo: dados.tipo?.slice(0, 100),
    }),
  );
}

export async function POST(request: Request) {
  const bruto = await request.text();
  const segredo = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";

  if (segredo) {
    if (!assinaturaWebhookValida(bruto, request.headers.get("stripe-signature"), segredo)) {
      registrar({ aplicado: false, motivo: "assinatura inválida" });
      return Response.json({ ok: false, error: "assinatura inválida" }, { status: 400 });
    }
  } else if (process.env.NODE_ENV === "production") {
    registrar({ aplicado: false, motivo: "STRIPE_WEBHOOK_SECRET ausente" });
    return Response.json({ ok: false, error: "webhook não configurado" }, { status: 503 });
  }

  let evento: EventoStripe;
  try {
    evento = JSON.parse(bruto) as EventoStripe;
  } catch {
    registrar({ aplicado: false, motivo: "json inválido" });
    return Response.json({ ok: false, error: "json inválido" }, { status: 400 });
  }

  try {
    const r = await aplicarEventoStripe(evento);
    registrar({ id: evento.id, tipo: evento.type, aplicado: r.aplicado, motivo: r.motivo });
    return Response.json({ ok: true });
  } catch (e) {
    registrar({
      id: evento?.id,
      tipo: evento?.type,
      aplicado: false,
      motivo: `erro: ${e instanceof Error ? e.message.slice(0, 120) : "desconhecido"}`,
    });
    return Response.json({ ok: false }, { status: 500 });
  }
}

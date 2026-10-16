import { aplicarEventoAsaas } from "@/lib/assinatura";

/**
 * POST /api/v1/webhook/asaas — eventos do Asaas (assinaturas).
 * Pública por necessidade (o Asaas chama sem JWT).
 *
 * Autenticação: se ASAAS_WEBHOOK_TOKEN estiver configurado, o header
 * `asaas-access-token` precisa conferir; sem token configurado (dev),
 * aceita e registra. Sempre responde 200 para não gerar reenvios —
 * idempotência pela tabela webhook_eventos.
 */
export async function POST(request: Request) {
  let evento: unknown;
  try {
    evento = await request.json();
  } catch {
    return Response.json({ ok: false });
  }

  const esperado = process.env.ASAAS_WEBHOOK_TOKEN;
  if (esperado) {
    const recebido = request.headers.get("asaas-access-token");
    if (recebido !== esperado) {
      return Response.json({ ok: false });
    }
  }

  const e = (evento ?? {}) as {
    id?: string;
    event?: string;
    checkout?: Record<string, string>;
    subscription?: Record<string, string>;
    payment?: Record<string, string>;
  };
  await aplicarEventoAsaas({
    id: String(e.id ?? ""),
    event: String(e.event ?? ""),
    checkout: e.checkout,
    subscription: e.subscription,
    payment: e.payment,
  });

  return Response.json({ ok: true });
}

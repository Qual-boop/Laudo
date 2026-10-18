import { aplicarEventoAsaas } from "@/lib/assinatura";

/**
 * POST /api/v1/webhook/asaas — eventos do Asaas (assinaturas).
 * Pública por necessidade (o Asaas chama sem JWT).
 *
 * Autenticação: se ASAAS_WEBHOOK_TOKEN estiver configurado, o header
 * `asaas-access-token` precisa conferir; sem token configurado (dev),
 * aceita e registra. Sempre responde 200 para não gerar reenvios —
 * idempotência pela tabela webhook_eventos. Como o status não diz nada,
 * cada chamada vira uma linha de log (`aplicado`/`motivo`) para auditoria.
 */
function registrar(dados: {
  id?: string;
  event?: string;
  aplicado: boolean;
  motivo?: string;
}) {
  // Só identificadores e o resultado — nada do payload (dados do cliente).
  // id/event podem vir de quem errou o token: cortados, e o JSON escapa
  // quebras de linha (sem injeção de linhas falsas no log).
  console.info(
    JSON.stringify({
      webhook: "asaas",
      ...dados,
      id: dados.id?.slice(0, 100),
      event: dados.event?.slice(0, 100),
    }),
  );
}

export async function POST(request: Request) {
  let evento: unknown;
  try {
    evento = await request.json();
  } catch {
    registrar({ aplicado: false, motivo: "json inválido" });
    return Response.json({ ok: false });
  }

  const e = (evento ?? {}) as {
    id?: string;
    event?: string;
    checkout?: Record<string, string>;
    subscription?: Record<string, string>;
    payment?: Record<string, string>;
  };
  const id = String(e.id ?? "");
  const event = String(e.event ?? "");

  const esperado = process.env.ASAAS_WEBHOOK_TOKEN;
  if (esperado) {
    const recebido = request.headers.get("asaas-access-token");
    if (recebido !== esperado) {
      registrar({ id, event, aplicado: false, motivo: "token inválido" });
      return Response.json({ ok: false });
    }
  }

  const r = await aplicarEventoAsaas({
    id,
    event,
    checkout: e.checkout,
    subscription: e.subscription,
    payment: e.payment,
  });
  registrar({ id, event, aplicado: r.aplicado, motivo: r.motivo });

  return Response.json({ ok: true });
}

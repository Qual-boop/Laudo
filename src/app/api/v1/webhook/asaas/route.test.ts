import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import db from "@/lib/db";
import { POST } from "@/app/api/v1/webhook/asaas/route";

function requisicao(corpo: string, token?: string): Request {
  return new Request("http://localhost/api/v1/webhook/asaas", {
    method: "POST",
    headers: token ? { "asaas-access-token": token } : {},
    body: corpo,
  });
}

let log: MockInstance<typeof console.info>;

/** Última linha de auditoria do webhook (JSON em console.info). */
function ultimoLog(): Record<string, unknown> {
  const linhas = log.mock.calls
    .map((c) => String(c[0]))
    .filter((l) => l.includes('"webhook":"asaas"'));
  return JSON.parse(linhas.at(-1) ?? "{}") as Record<string, unknown>;
}

beforeEach(() => {
  log = vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  log.mockRestore();
  vi.unstubAllEnvs();
});

afterAll(() => {
  db.prepare("DELETE FROM webhook_eventos WHERE id LIKE 'evt_rota_%'").run();
});

describe("webhook Asaas: responde 200 e registra aplicado/motivo", () => {
  it("evento ignorado por regra vira log com motivo", async () => {
    const res = await POST(
      requisicao(JSON.stringify({ id: "evt_rota_001", event: "PAYMENT_CREATED" })),
    );
    expect(res.status).toBe(200);
    expect(ultimoLog()).toEqual({
      webhook: "asaas",
      id: "evt_rota_001",
      event: "PAYMENT_CREATED",
      aplicado: false,
      motivo: "evento ignorado",
    });
  });

  it("reenvio do mesmo evento registra 'evento já processado'", async () => {
    const corpo = JSON.stringify({ id: "evt_rota_002", event: "PAYMENT_CREATED" });
    await POST(requisicao(corpo));
    const res = await POST(requisicao(corpo));
    expect(res.status).toBe(200);
    expect(ultimoLog()).toMatchObject({ aplicado: false, motivo: "evento já processado" });
  });

  it("token errado: 200 sem aplicar, log 'token inválido'", async () => {
    vi.stubEnv("ASAAS_WEBHOOK_TOKEN", "segredo-certo");
    const res = await POST(
      requisicao(
        JSON.stringify({ id: "evt_rota_003", event: "CHECKOUT_PAID" }),
        "segredo-errado",
      ),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false });
    expect(ultimoLog()).toMatchObject({
      id: "evt_rota_003",
      aplicado: false,
      motivo: "token inválido",
    });
    const gravado = db
      .prepare("SELECT id FROM webhook_eventos WHERE id = ?")
      .get("evt_rota_003");
    expect(gravado).toBeUndefined();
  });

  it("JSON inválido: 200 e log 'json inválido'", async () => {
    const res = await POST(requisicao("{nao-e-json"));
    expect(res.status).toBe(200);
    expect(ultimoLog()).toMatchObject({ aplicado: false, motivo: "json inválido" });
  });

  it("log não leva o payload (dados do cliente)", async () => {
    await POST(
      requisicao(
        JSON.stringify({
          id: "evt_rota_004",
          event: "PAYMENT_CREATED",
          payment: { customer: "cus_x", billingType: "CREDIT_CARD", value: "49.9" },
        }),
      ),
    );
    expect(Object.keys(ultimoLog()).sort()).toEqual(
      ["aplicado", "event", "id", "motivo", "webhook"],
    );
  });
});

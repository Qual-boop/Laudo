import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import { POST } from "@/app/api/v1/webhook/asaas/autorizacao-saque/route";

function requisicao(corpo: string, token?: string): Request {
  return new Request("http://localhost/api/v1/webhook/asaas/autorizacao-saque", {
    method: "POST",
    headers: token ? { "asaas-access-token": token } : {},
    body: corpo,
  });
}

// Formato do exemplo oficial (docs Asaas: validação de saque via webhooks).
const TRANSFERENCIA = JSON.stringify({
  type: "TRANSFER",
  transfer: {
    object: "transfer",
    id: "0bed986c-737d-49bf-a1cc-beca916797c4",
    status: "PENDING",
    value: 22,
    bankAccount: { cpfCnpj: "70609293000194", account: "42142" },
    operationType: "PIX",
  },
});

let log: MockInstance<typeof console.warn>;

function ultimoLog(): Record<string, unknown> {
  return JSON.parse(String(log.mock.calls.at(-1)?.[0] ?? "{}")) as Record<string, unknown>;
}

beforeEach(() => {
  log = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  log.mockRestore();
  vi.unstubAllEnvs();
});

describe("autorização de saque Asaas: recusa tudo", () => {
  it("transferência com token certo é recusada e registrada como do Asaas", async () => {
    vi.stubEnv("ASAAS_SAQUE_TOKEN", "segredo-certo");
    const res = await POST(requisicao(TRANSFERENCIA, "segredo-certo"));
    expect(res.status).toBe(200);
    const corpo = (await res.json()) as { status: string; refuseReason: string };
    expect(corpo.status).toBe("REFUSED");
    expect(corpo.refuseReason).toMatch(/bloqueados/);
    expect(ultimoLog()).toEqual({
      webhook: "asaas-saque",
      recusado: true,
      doAsaas: true,
      tipo: "TRANSFER",
      id: "0bed986c-737d-49bf-a1cc-beca916797c4",
      valor: 22,
    });
  });

  it("log não leva dados bancários do destinatário", async () => {
    await POST(requisicao(TRANSFERENCIA));
    const linha = String(log.mock.calls.at(-1)?.[0]);
    expect(linha).not.toContain("70609293000194");
    expect(linha).not.toContain("42142");
  });

  it.each([
    ["token errado", TRANSFERENCIA, "segredo-errado"],
    ["sem token", TRANSFERENCIA, undefined],
    ["outro tipo (Pix QR Code)", JSON.stringify({ type: "PIX_QR_CODE", pixQrCode: { id: "q1", value: 10 } }), "segredo-certo"],
    ["corpo inválido", "{não é json", "segredo-certo"],
    ["corpo vazio", "", undefined],
  ])("%s → REFUSED", async (_nome, corpo, token) => {
    vi.stubEnv("ASAAS_SAQUE_TOKEN", "segredo-certo");
    const res = await POST(requisicao(corpo, token));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { status: string }).status).toBe("REFUSED");
  });

  it("sem ASAAS_SAQUE_TOKEN configurado continua recusando", async () => {
    const res = await POST(requisicao(TRANSFERENCIA, "qualquer"));
    expect(((await res.json()) as { status: string }).status).toBe("REFUSED");
    expect(ultimoLog()).toMatchObject({ doAsaas: false });
  });
});

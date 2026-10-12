import { afterAll, describe, expect, it } from "vitest";
import db from "@/lib/db";
import {
  aplicarEventoAsaas,
  assinaturaDe,
} from "@/lib/assinatura";
import { criarUsuario } from "@/lib/usuarios";

const EMAIL = "qa.assinatura@laudo-teste.com";

function limparEventos() {
  db.prepare("DELETE FROM webhook_eventos").run();
}

describe("assinatura (Asaas)", () => {
  it("CHECKOUT_PAID ativa o plano pela referência", async () => {
    const u = (await criarUsuario("QA Ass", EMAIL, "senha-123456"))!;
    const r = aplicarEventoAsaas({
      id: "evt_teste_001",
      event: "CHECKOUT_PAID",
      checkout: { id: "ck_1", customer: "cus_1", externalReference: `${u.id}:pro:mensal` },
    });
    expect(r).toMatchObject({ ok: true, aplicado: true });
    const linha = db
      .prepare("SELECT plano, assinatura_status, assinatura_ciclo FROM usuarios WHERE id = ?")
      .get(u.id) as Record<string, string>;
    expect(linha.plano).toBe("pro");
    expect(linha.assinatura_status).toBe("ativa");
    expect(linha.assinatura_ciclo).toBe("MONTHLY");
  });

  it("idempotência: mesmo evento 2x aplica só uma vez", async () => {
    const u = (
      db.prepare("SELECT id FROM usuarios WHERE email = ?").get(EMAIL) as { id: number }
    );
    const r = aplicarEventoAsaas({
      id: "evt_teste_001",
      event: "CHECKOUT_PAID",
      checkout: { id: "ck_1", customer: "cus_1", externalReference: `${u.id}:pro:mensal` },
    });
    expect(r).toMatchObject({ ok: true, aplicado: false });
  });

  it("SUBSCRIPTION_CREATED salva o id da assinatura", () => {
    const u = (
      db.prepare("SELECT id FROM usuarios WHERE email = ?").get(EMAIL) as { id: number }
    );
    db.prepare("UPDATE usuarios SET asaas_customer_id = 'cus_1' WHERE id = ?").run(u.id);
    const r = aplicarEventoAsaas({
      id: "evt_teste_002",
      event: "SUBSCRIPTION_CREATED",
      subscription: { id: "sub_1", customer: "cus_1", cycle: "MONTHLY" },
    });
    expect(r.aplicado).toBe(true);
    const linha = db
      .prepare("SELECT asaas_subscription_id FROM usuarios WHERE id = ?")
      .get(u.id) as { asaas_subscription_id: string };
    expect(linha.asaas_subscription_id).toBe("sub_1");
  });

  it("PAYMENT_OVERDUE marca past_due sem cancelar", () => {
    const r = aplicarEventoAsaas({
      id: "evt_teste_003",
      event: "PAYMENT_OVERDUE",
      payment: { id: "pay_1", subscription: "sub_1" },
    });
    expect(r.aplicado).toBe(true);
    const u = (
      db.prepare("SELECT plano, assinatura_status FROM usuarios WHERE email = ?").get(EMAIL) as {
        plano: string;
        assinatura_status: string;
      }
    );
    expect(u.plano).toBe("pro");
    expect(u.assinatura_status).toBe("past_due");
  });

  it("SUBSCRIPTION_DELETED volta para free", () => {
    const r = aplicarEventoAsaas({
      id: "evt_teste_004",
      event: "SUBSCRIPTION_DELETED",
      subscription: { id: "sub_1" },
    });
    expect(r.aplicado).toBe(true);
    const u = (
      db.prepare("SELECT plano, asaas_subscription_id FROM usuarios WHERE email = ?").get(EMAIL) as {
        plano: string;
        asaas_subscription_id: string | null;
      }
    );
    expect(u.plano).toBe("free");
    expect(u.asaas_subscription_id).toBeNull();
  });

  it("assinaturaDe degrada plano expirado (lazy downgrade)", () => {
    const a = assinaturaDe({
      id: 1,
      plano: "pro",
      plano_expira_em: "2000-01-01T00:00:00.000Z",
      asaas_subscription_id: null,
    });
    expect(a.plano).toBe("free");
  });

  it("trial = pro sem subscription", () => {
    const a = assinaturaDe({
      id: 1,
      plano: "pro",
      plano_expira_em: new Date(Date.now() + 86400_000).toISOString(),
      asaas_subscription_id: null,
    });
    expect(a.plano).toBe("pro");
    expect(a.trial).toBe(true);
  });

  afterAll(() => {
    limparEventos();
    db.prepare("DELETE FROM usuarios WHERE email = ?").run(EMAIL);
  });
});

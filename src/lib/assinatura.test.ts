import { afterAll, describe, expect, it } from "vitest";
import db from "@/lib/db";
import {
  aplicarEventoAsaas,
  assinaturaDe,
  fimDoPeriodo,
} from "@/lib/assinatura";
import { criarUsuario } from "@/lib/usuarios";

const EMAIL = "qa.assinatura@laudo-teste.com";

// Só os eventos deste arquivo: os arquivos de teste rodam em paralelo no
// mesmo SQLite (o teste da rota do webhook também grava eventos).
function limparEventos() {
  db.prepare("DELETE FROM webhook_eventos WHERE id LIKE 'evt_teste_%'").run();
}

describe("assinatura (Asaas)", () => {
  it("CHECKOUT_PAID ativa o plano pela referência", async () => {
    const u = (await criarUsuario("QA Ass", EMAIL, "senha-123456"))!;
    const r = await aplicarEventoAsaas({
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
    const r = await aplicarEventoAsaas({
      id: "evt_teste_001",
      event: "CHECKOUT_PAID",
      checkout: { id: "ck_1", customer: "cus_1", externalReference: `${u.id}:pro:mensal` },
    });
    expect(r).toMatchObject({ ok: true, aplicado: false });
  });

  it("SUBSCRIPTION_CREATED salva o id da assinatura", async () => {
    const u = (
      db.prepare("SELECT id FROM usuarios WHERE email = ?").get(EMAIL) as { id: number }
    );
    db.prepare("UPDATE usuarios SET asaas_customer_id = 'cus_1' WHERE id = ?").run(u.id);
    const r = await aplicarEventoAsaas({
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

  it("PAYMENT_OVERDUE marca past_due sem cancelar", async () => {
    const r = await aplicarEventoAsaas({
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

  it("SUBSCRIPTION_DELETED volta para free", async () => {
    const r = await aplicarEventoAsaas({
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

  it("assinaturaDe degrada plano expirado (lazy downgrade)", async () => {
    const a = await assinaturaDe({
      id: 1,
      plano: "pro",
      plano_expira_em: "2000-01-01T00:00:00.000Z",
      asaas_subscription_id: null,
    });
    expect(a.plano).toBe("free");
  });

  it("trial = pro sem subscription", async () => {
    const a = await assinaturaDe({
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

const EMAIL_COBRANCA = "qa.cobranca@laudo-teste.com";
const DIA = 24 * 60 * 60 * 1000;

/** Vencimento da 1ª cobrança: amanhã, como em criarCheckout (lib/asaas.ts). */
function amanha(): string {
  return new Date(Date.now() + DIA).toISOString().slice(0, 10);
}

/** Mesmo dia do mês seguinte ("YYYY-MM-DD"): vencimento da renovação. */
function mesSeguinte(data: string): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

function diasAteExpirar(id: number): number {
  const { plano_expira_em } = db
    .prepare("SELECT plano_expira_em FROM usuarios WHERE id = ?")
    .get(id) as { plano_expira_em: string };
  return (new Date(plano_expira_em).getTime() - Date.now()) / DIA;
}

/** Usuário com customer e subscription já vinculados (SUBSCRIPTION_CREATED). */
async function assinante(sufixo: string): Promise<number> {
  db.prepare("DELETE FROM usuarios WHERE email = ?").run(EMAIL_COBRANCA);
  const u = (await criarUsuario("QA Cobrança", EMAIL_COBRANCA, "senha-123456"))!;
  db.prepare(
    "UPDATE usuarios SET asaas_customer_id = ?, asaas_subscription_id = ? WHERE id = ?",
  ).run(`cus_${sufixo}`, `sub_${sufixo}`, u.id);
  return u.id;
}

function checkoutPago(id: string, usuarioId: number, periodo = "mensal") {
  return aplicarEventoAsaas({
    id,
    event: "CHECKOUT_PAID",
    checkout: { id: "ck_c", externalReference: `${usuarioId}:pro:${periodo}` },
  });
}

function pagamento(id: string, event: string, sub: string, dueDate: string) {
  return aplicarEventoAsaas({
    id,
    event,
    payment: { id: `pay_${sub}_${dueDate}`, subscription: sub, dueDate },
  });
}

// Limites folgados: +1 mês de calendário vai de 28 a 31 dias, e o
// vencimento (amanhã, até 23:59 BRT) soma até ~2 dias.
describe("cobrança: 1º pagamento conta uma vez só", () => {
  it("fimDoPeriodo: +1 mês/ano de calendário até 23:59:59 BRT do vencimento", () => {
    expect(fimDoPeriodo("MONTHLY", "2026-10-18").toISOString()).toBe(
      "2026-11-19T02:59:59.999Z",
    );
    expect(fimDoPeriodo("YEARLY", "2026-10-18").toISOString()).toBe(
      "2027-10-19T02:59:59.999Z",
    );
    expect(fimDoPeriodo(undefined, "2026-12-31").toISOString()).toBe(
      "2027-02-01T02:59:59.999Z",
    );
  });

  it("CHECKOUT_PAID + 1º PAYMENT_RECEIVED = ~1 mês (não ~60 dias)", async () => {
    const id = await assinante("c1");
    expect((await checkoutPago("evt_teste_c101", id)).aplicado).toBe(true);
    await pagamento("evt_teste_c102", "PAYMENT_RECEIVED", "sub_c1", amanha());
    const dias = diasAteExpirar(id);
    expect(dias).toBeGreaterThan(27);
    expect(dias).toBeLessThan(35);
  });

  it("CONFIRMED + RECEIVED da mesma cobrança, fora de ordem, não somam", async () => {
    const id = await assinante("c2");
    // 1ª cobrança confirmada antes do CHECKOUT_PAID chegar.
    expect(
      (await pagamento("evt_teste_c201", "PAYMENT_CONFIRMED", "sub_c2", amanha())).aplicado,
    ).toBe(true);
    expect((await checkoutPago("evt_teste_c202", id)).aplicado).toBe(true);
    // RECEIVED do cartão chega bem depois, mesma cobrança.
    const r = await pagamento("evt_teste_c203", "PAYMENT_RECEIVED", "sub_c2", amanha());
    expect(r).toMatchObject({ ok: true, aplicado: false, motivo: "período já coberto" });
    const dias = diasAteExpirar(id);
    expect(dias).toBeGreaterThan(27);
    expect(dias).toBeLessThan(35);
  });

  it("renovação (vencimento do mês seguinte) cobre o 2º mês", async () => {
    const id = await assinante("c3");
    await checkoutPago("evt_teste_c301", id);
    await pagamento("evt_teste_c302", "PAYMENT_CONFIRMED", "sub_c3", amanha());
    const r = await pagamento(
      "evt_teste_c303",
      "PAYMENT_RECEIVED",
      "sub_c3",
      mesSeguinte(amanha()),
    );
    expect(r.aplicado).toBe(true);
    const dias = diasAteExpirar(id);
    expect(dias).toBeGreaterThan(56);
    expect(dias).toBeLessThan(66);
  });

  it("anual: CHECKOUT_PAID + 1ª cobrança = ~1 ano", async () => {
    const id = await assinante("c4");
    await checkoutPago("evt_teste_c401", id, "anual");
    await pagamento("evt_teste_c402", "PAYMENT_RECEIVED", "sub_c4", amanha());
    const dias = diasAteExpirar(id);
    expect(dias).toBeGreaterThan(364);
    expect(dias).toBeLessThan(369);
  });

  it("pagamento tira de past_due mesmo com o período já coberto", async () => {
    const id = await assinante("c5");
    await checkoutPago("evt_teste_c501", id);
    await pagamento("evt_teste_c502", "PAYMENT_CONFIRMED", "sub_c5", amanha());
    db.prepare("UPDATE usuarios SET assinatura_status = 'past_due' WHERE id = ?").run(id);
    await pagamento("evt_teste_c503", "PAYMENT_RECEIVED", "sub_c5", amanha());
    const { assinatura_status } = db
      .prepare("SELECT assinatura_status FROM usuarios WHERE id = ?")
      .get(id) as { assinatura_status: string };
    expect(assinatura_status).toBe("ativa");
  });

  afterAll(() => {
    limparEventos();
    db.prepare("DELETE FROM usuarios WHERE email = ?").run(EMAIL_COBRANCA);
  });
});

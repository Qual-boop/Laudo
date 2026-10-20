import { createHmac } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import db from "@/lib/db";
import { aplicarEventoStripe, assinaturaDe, type EventoStripe } from "@/lib/assinatura";
import { assinaturaWebhookValida, codificarForm } from "@/lib/stripe";
import { POST as webhook } from "@/app/api/v1/webhook/stripe/route";
import { criarUsuario } from "@/lib/usuarios";

const EMAIL = "qa.stripe@laudo-teste.com";
const DIA = 86_400_000;
let seq = 0;

function evento(type: string, object: Record<string, unknown>): EventoStripe {
  seq += 1;
  return { id: `evt_teste_stripe_${Date.now()}_${seq}`, type, data: { object } };
}

function ler(id: number) {
  return db
    .prepare(
      `SELECT plano, plano_expira_em, stripe_customer_id, stripe_subscription_id,
              assinatura_status, assinatura_plano, assinatura_ciclo FROM usuarios WHERE id = ?`,
    )
    .get(id) as Record<string, string | null>;
}

async function novoUsuario(): Promise<number> {
  db.prepare("DELETE FROM usuarios WHERE email = ?").run(EMAIL);
  const u = (await criarUsuario("QA Stripe", EMAIL, "frase de teste 77"))!;
  db.prepare("UPDATE usuarios SET stripe_customer_id = 'cus_qa' WHERE id = ?").run(u.id);
  return u.id;
}

function checkoutPago(usuarioId: number, plano = "pro", periodo = "mensal") {
  return evento("checkout.session.completed", {
    id: "cs_qa",
    customer: "cus_qa",
    subscription: "sub_qa",
    client_reference_id: String(usuarioId),
    payment_status: "paid",
    metadata: { usuario_id: String(usuarioId), plano, periodo },
  });
}

/** Fatura no formato novo da API (assinatura em parent.subscription_details). */
function faturaPaga(fimSeg: number, plano = "pro") {
  return evento("invoice.paid", {
    id: "in_qa",
    customer: "cus_qa",
    parent: { subscription_details: { subscription: "sub_qa", metadata: { plano } } },
    lines: { data: [{ period: { start: fimSeg - 30 * 86400, end: fimSeg } }] },
  });
}

afterAll(() => {
  db.prepare("DELETE FROM webhook_eventos WHERE id LIKE 'evt_teste_stripe_%'").run();
  db.prepare("DELETE FROM usuarios WHERE email = ?").run(EMAIL);
});

describe("Stripe: assinatura do webhook", () => {
  const segredo = "whsec_teste";
  const corpo = '{"id":"evt_1"}';
  const agora = 1_800_000_000;
  const assinar = (t: number, c = corpo, s = segredo) =>
    `t=${t},v1=${createHmac("sha256", s).update(`${t}.${c}`).digest("hex")}`;

  it("aceita assinatura correta", () => {
    expect(assinaturaWebhookValida(corpo, assinar(agora), segredo, agora)).toBe(true);
  });
  it("recusa corpo alterado, segredo errado e cabeçalho ausente", () => {
    expect(assinaturaWebhookValida('{"id":"evt_2"}', assinar(agora), segredo, agora)).toBe(false);
    expect(assinaturaWebhookValida(corpo, assinar(agora, corpo, "whsec_outro"), segredo, agora)).toBe(false);
    expect(assinaturaWebhookValida(corpo, null, segredo, agora)).toBe(false);
  });
  it("recusa assinatura velha (replay > 5 min)", () => {
    expect(assinaturaWebhookValida(corpo, assinar(agora - 301), segredo, agora)).toBe(false);
  });
  it("codificarForm gera o formato aninhado do Stripe", () => {
    expect(
      codificarForm({ a: "1", b: { c: "2" }, d: [{ e: "3" }] }).map(decodeURIComponent),
    ).toEqual(["a=1", "b[c]=2", "d[0][e]=3"]);
  });
});

describe("Stripe: eventos", () => {
  it("checkout pago ativa o plano, grava ids e plano assinado", async () => {
    const id = await novoUsuario();
    const r = await aplicarEventoStripe(checkoutPago(id, "team", "anual"));
    expect(r.aplicado).toBe(true);
    expect(ler(id)).toMatchObject({
      plano: "team",
      stripe_subscription_id: "sub_qa",
      assinatura_status: "ativa",
      assinatura_plano: "team",
      assinatura_ciclo: "anual",
    });
    const dias = (new Date(ler(id).plano_expira_em!).getTime() - Date.now()) / DIA;
    expect(dias).toBeGreaterThan(364);
  });

  it("mesmo evento duas vezes aplica uma só", async () => {
    const id = await novoUsuario();
    const e = checkoutPago(id);
    expect((await aplicarEventoStripe(e)).aplicado).toBe(true);
    expect(await aplicarEventoStripe(e)).toMatchObject({ aplicado: false, motivo: "evento já processado" });
  });

  it("checkout sem pagamento confirmado não ativa", async () => {
    const id = await novoUsuario();
    const e = checkoutPago(id);
    e.data.object.payment_status = "unpaid";
    expect((await aplicarEventoStripe(e)).aplicado).toBe(false);
    expect(ler(id).plano).toBe("free");
  });

  it("invoice.paid usa o fim real do período e nunca encurta", async () => {
    const id = await novoUsuario();
    await aplicarEventoStripe(checkoutPago(id));
    const fim = Math.floor((Date.now() + 40 * DIA) / 1000);
    expect((await aplicarEventoStripe(faturaPaga(fim))).aplicado).toBe(true);
    expect(new Date(ler(id).plano_expira_em!).getTime()).toBe(fim * 1000);
    // Fatura repetida/antiga não reduz a data.
    const r = await aplicarEventoStripe(faturaPaga(fim - 10 * 86400));
    expect(r).toMatchObject({ aplicado: false, motivo: "período já coberto" });
  });

  it("pagamento depois de expirar devolve o plano assinado", async () => {
    const id = await novoUsuario();
    await aplicarEventoStripe(checkoutPago(id, "team"));
    db.prepare("UPDATE usuarios SET plano_expira_em = ? WHERE id = ?").run(
      new Date(Date.now() - DIA).toISOString(),
      id,
    );
    const u = db.prepare("SELECT * FROM usuarios WHERE id = ?").get(id) as Parameters<typeof assinaturaDe>[0];
    expect((await assinaturaDe(u)).plano).toBe("free");
    const r = await aplicarEventoStripe(faturaPaga(Math.floor((Date.now() + 30 * DIA) / 1000), "team"));
    expect(r).toMatchObject({ aplicado: true, motivo: "plano restaurado" });
    expect(ler(id).plano).toBe("team");
  });

  it("falha de pagamento marca past_due sem tirar o plano", async () => {
    const id = await novoUsuario();
    await aplicarEventoStripe(checkoutPago(id));
    await aplicarEventoStripe(
      evento("invoice.payment_failed", { customer: "cus_qa", subscription: "sub_qa" }),
    );
    expect(ler(id)).toMatchObject({ plano: "pro", assinatura_status: "past_due" });
  });

  it("cancelar no fim do período: status cancelada, plano segue", async () => {
    const id = await novoUsuario();
    await aplicarEventoStripe(checkoutPago(id));
    await aplicarEventoStripe(
      evento("customer.subscription.updated", {
        id: "sub_qa",
        customer: "cus_qa",
        status: "active",
        cancel_at_period_end: true,
      }),
    );
    expect(ler(id)).toMatchObject({ plano: "pro", assinatura_status: "cancelada" });
  });

  it("assinatura encerrada volta para free e limpa ids", async () => {
    const id = await novoUsuario();
    await aplicarEventoStripe(checkoutPago(id));
    await aplicarEventoStripe(evento("customer.subscription.deleted", { id: "sub_qa" }));
    expect(ler(id)).toMatchObject({
      plano: "free",
      stripe_subscription_id: null,
      assinatura_plano: null,
    });
  });

  it("trial = pro sem assinatura; cancelada não é trial", async () => {
    const base = {
      id: 1,
      plano: "pro",
      plano_expira_em: new Date(Date.now() + DIA).toISOString(),
      stripe_subscription_id: null,
    };
    expect((await assinaturaDe(base)).trial).toBe(true);
    expect((await assinaturaDe({ ...base, assinatura_status: "cancelada" })).trial).toBe(false);
  });
});

describe("rota do webhook", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_rota");
    vi.spyOn(console, "info").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function req(corpo: string, assinatura?: string) {
    return new Request("http://localhost/api/v1/webhook/stripe", {
      method: "POST",
      headers: assinatura ? { "stripe-signature": assinatura } : {},
      body: corpo,
    });
  }

  it("assinatura inválida → 400, nada aplicado", async () => {
    const res = await webhook(req('{"id":"evt_x","type":"invoice.paid","data":{"object":{}}}', "t=1,v1=00"));
    expect(res.status).toBe(400);
  });

  it("assinatura válida → 200", async () => {
    const corpo = JSON.stringify(evento("ping.qualquer", { id: "x" }));
    const t = Math.floor(Date.now() / 1000);
    const sig = createHmac("sha256", "whsec_rota").update(`${t}.${corpo}`).digest("hex");
    const res = await webhook(req(corpo, `t=${t},v1=${sig}`));
    expect(res.status).toBe(200);
  });

  it("produção sem segredo configurado → 503", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    const res = await webhook(req("{}"));
    expect(res.status).toBe(503);
  });
});

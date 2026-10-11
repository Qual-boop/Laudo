import { afterAll, describe, expect, it } from "vitest";
import db from "@/lib/db";
import {
  aplicarEventoWebhook,
  assinaturaDe,
  precoPara,
} from "@/lib/assinatura";
import { criarUsuario } from "@/lib/usuarios";

const EMAIL = "qa.assinatura@laudo-teste.com";

function eventoCheckout(usuarioId: number) {
  return {
    type: "checkout.session.completed",
    data: {
      object: {
        metadata: { usuarioId: String(usuarioId), plano: "pro" },
        customer: "cus_teste_123",
        subscription: "sub_teste_123",
      },
    },
  };
}

describe("assinatura", () => {
  it("precoPara devolve null sem env configurada", () => {
    expect(precoPara("pro", "mensal")).toBeNull();
  });

  it("checkout.session.completed vira pro com customer+subscription", async () => {
    const u = (await criarUsuario("QA Ass", EMAIL, "senha-123456"))!;
    const r = aplicarEventoWebhook(eventoCheckout(u.id));
    expect(r.ok).toBe(true);
    const linha = db
      .prepare("SELECT plano, stripe_customer_id, stripe_subscription_id FROM usuarios WHERE id = ?")
      .get(u.id) as Record<string, string>;
    expect(linha.plano).toBe("pro");
    expect(linha.stripe_customer_id).toBe("cus_teste_123");
    expect(linha.stripe_subscription_id).toBe("sub_teste_123");
  });

  it("subscription.deleted volta para free", async () => {
    const u = (
      db.prepare("SELECT id FROM usuarios WHERE email = ?").get(EMAIL) as { id: number }
    );
    const r = aplicarEventoWebhook({
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_teste_123", status: "canceled" } },
    });
    expect(r.ok).toBe(true);
    const linha = db
      .prepare("SELECT plano, stripe_subscription_id FROM usuarios WHERE id = ?")
      .get(u.id) as Record<string, string | null>;
    expect(linha.plano).toBe("free");
    expect(linha.stripe_subscription_id).toBeNull();
  });

  it("rejeita metadata inválida sem tocar no banco", () => {
    const r = aplicarEventoWebhook({
      type: "checkout.session.completed",
      data: { object: { metadata: { plano: "pro" } } },
    });
    expect(r.ok).toBe(false);
  });

  it("assinaturaDe degrada plano expirado (lazy downgrade)", async () => {
    const u = (
      db.prepare("SELECT id FROM usuarios WHERE email = ?").get(EMAIL) as { id: number }
    );
    db.prepare(
      "UPDATE usuarios SET plano = 'pro', plano_expira_em = '2000-01-01T00:00:00.000Z' WHERE id = ?",
    ).run(u.id);
    const a = assinaturaDe({
      id: u.id,
      plano: "pro",
      plano_expira_em: "2000-01-01T00:00:00.000Z",
      stripe_subscription_id: null,
    });
    expect(a.plano).toBe("free");
    const linha = db
      .prepare("SELECT plano FROM usuarios WHERE id = ?")
      .get(u.id) as { plano: string };
    expect(linha.plano).toBe("free");
  });

  it("trial = pro sem subscription", () => {
    const a = assinaturaDe({
      id: 1,
      plano: "pro",
      plano_expira_em: new Date(Date.now() + 86400_000).toISOString(),
      stripe_subscription_id: null,
    });
    expect(a.plano).toBe("pro");
    expect(a.trial).toBe(true);
  });

  afterAll(() => {
    db.prepare("DELETE FROM usuarios WHERE email = ?").run(EMAIL);
  });
});

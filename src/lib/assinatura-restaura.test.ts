import { afterAll, beforeAll, describe, expect, it } from "vitest";
import db from "@/lib/db";
import { aplicarEventoAsaas, assinaturaDe } from "@/lib/assinatura";
import { criarUsuario } from "@/lib/usuarios";

const EMAIL = "qa.restaura@laudo-teste.com";
let id = 0;

type Linha = {
  id: number;
  plano: string;
  plano_expira_em: string | null;
  asaas_subscription_id: string | null;
  assinatura_status: string | null;
  assinatura_plano: string | null;
};

function ler(): Linha {
  return db
    .prepare(
      "SELECT id, plano, plano_expira_em, asaas_subscription_id, assinatura_status, assinatura_plano FROM usuarios WHERE id = ?",
    )
    .get(id) as Linha;
}

beforeAll(async () => {
  db.prepare("DELETE FROM usuarios WHERE email = ?").run(EMAIL);
  id = (await criarUsuario("QA Restaura", EMAIL, "senha-123456"))!.id;
});

afterAll(() => {
  db.prepare("DELETE FROM webhook_eventos WHERE id LIKE 'evt_rest_%'").run();
  db.prepare("DELETE FROM usuarios WHERE email = ?").run(EMAIL);
});

describe("assinatura: pagamento atrasado devolve o plano", () => {
  it("CHECKOUT_PAID grava o plano assinado", async () => {
    await aplicarEventoAsaas({
      id: "evt_rest_001",
      event: "CHECKOUT_PAID",
      checkout: { externalReference: `${id}:team:mensal` },
    });
    db.prepare("UPDATE usuarios SET asaas_subscription_id = 'sub_rest' WHERE id = ?").run(id);
    expect(ler()).toMatchObject({ plano: "team", assinatura_plano: "team" });
  });

  it("expirou → free; o pagamento que chega depois restaura o Team", async () => {
    db.prepare("UPDATE usuarios SET plano_expira_em = ? WHERE id = ?").run(
      new Date(Date.now() - 86_400_000).toISOString(),
      id,
    );
    expect((await assinaturaDe(ler())).plano).toBe("free"); // downgrade preguiçoso
    expect(ler().plano).toBe("free");

    const hoje = new Date().toISOString().slice(0, 10);
    const r = await aplicarEventoAsaas({
      id: "evt_rest_002",
      event: "PAYMENT_CONFIRMED",
      payment: { id: "pay_rest", subscription: "sub_rest", dueDate: hoje },
    });
    expect(r.aplicado).toBe(true);
    const depois = ler();
    expect(depois.plano).toBe("team");
    expect(new Date(depois.plano_expira_em!).getTime()).toBeGreaterThan(Date.now());
  });

  it("SUBSCRIPTION_DELETED limpa o plano assinado (pagamento perdido não restaura)", async () => {
    await aplicarEventoAsaas({
      id: "evt_rest_003",
      event: "SUBSCRIPTION_DELETED",
      subscription: { id: "sub_rest" },
    });
    expect(ler()).toMatchObject({ plano: "free", assinatura_plano: null });
  });

  it("cancelada com período pago não aparece como trial", async () => {
    const r = await assinaturaDe({
      id,
      plano: "pro",
      plano_expira_em: new Date(Date.now() + 5 * 86_400_000).toISOString(),
      asaas_subscription_id: null,
      assinatura_status: "cancelada",
    });
    expect(r).toMatchObject({ plano: "pro", trial: false });
  });
});

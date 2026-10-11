import Stripe from "stripe";
import db from "@/lib/db";
import { definirPlano } from "@/lib/usuarios";
import type { Plano } from "@/lib/planos";

/**
 * Billing Stripe (Checkout + Portal + webhook). Test-first: use chaves
 * `sk_test_` / `whsec_` até validar, só então troque pelas de produção.
 */

export type PlanoPago = Exclude<Plano, "free">;
export type Periodo = "mensal" | "anual";

const PRECOS: Record<`${PlanoPago}_${Periodo}`, string | undefined> = {
  pro_mensal: process.env.STRIPE_PRICE_PRO_MENSAL,
  pro_anual: process.env.STRIPE_PRICE_PRO_ANUAL,
  team_mensal: process.env.STRIPE_PRICE_TEAM_MENSAL,
  team_anual: process.env.STRIPE_PRICE_TEAM_ANUAL,
};

export function precoPara(plano: PlanoPago, periodo: Periodo): string | null {
  return PRECOS[`${plano}_${periodo}`] || null;
}

let stripeInstancia: Stripe | null = null;

export function stripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!stripeInstancia) {
    stripeInstancia = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeInstancia;
}

export type ItemAssinatura = {
  plano: Plano;
  expiraEm: string | null;
  subscriptionId: string | null;
  trial: boolean;
};

/** Plano efetivo: pro/team expirado volta a ser free (com downgrade lazy). */
export function assinaturaDe(usuario: {
  id: number;
  plano: string;
  plano_expira_em: string | null;
  stripe_subscription_id: string | null;
}): ItemAssinatura {
  const plano =
    usuario.plano === "pro" || usuario.plano === "team" ? usuario.plano : "free";
  const expira = usuario.plano_expira_em;
  const expirado = !!expira && new Date(expira).getTime() < Date.now();

  if (plano !== "free" && expirado) {
    definirPlano(usuario.id, "free");
    return { plano: "free", expiraEm: null, subscriptionId: null, trial: false };
  }

  return {
    plano,
    expiraEm: expira,
    subscriptionId: usuario.stripe_subscription_id,
    trial: plano !== "free" && !usuario.stripe_subscription_id,
  };
}

/** Aplica eventos do webhook na conta (idempotente por natureza: set direto). */
export function aplicarEventoWebhook(evento: {
  type: string;
  data: { object: Record<string, unknown> };
}): { ok: boolean; motivo?: string } {
  const obj = evento.data.object;

  if (evento.type === "checkout.session.completed") {
    const usuarioId = Number(
      (obj.metadata as Record<string, unknown> | undefined)?.usuarioId,
    );
    const plano = (obj.metadata as Record<string, unknown> | undefined)?.plano;
    if (!Number.isInteger(usuarioId) || (plano !== "pro" && plano !== "team")) {
      return { ok: false, motivo: "metadata sem usuarioId/plano" };
    }
    const customer = obj.customer;
    const subscription = obj.subscription;
    db.prepare(
      `UPDATE usuarios SET plano = ?, stripe_customer_id = COALESCE(?, stripe_customer_id),
        stripe_subscription_id = COALESCE(?, stripe_subscription_id),
        plano_expira_em = NULL, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`,
    ).run(
      plano,
      typeof customer === "string" ? customer : null,
      typeof subscription === "string" ? subscription : null,
      usuarioId,
    );
    return { ok: true };
  }

  if (
    evento.type === "customer.subscription.updated" ||
    evento.type === "customer.subscription.deleted"
  ) {
    const subscriptionId = typeof obj.id === "string" ? obj.id : null;
    if (!subscriptionId) return { ok: false, motivo: "sem subscription id" };
    const status = obj.status as string | undefined;
    const ativa = status === "active" || status === "trialing";
    const periodoFim = (obj as { current_period_end?: number }).current_period_end;
    const expira = periodoFim
      ? new Date(periodoFim * 1000).toISOString()
      : null;
    if (evento.type === "customer.subscription.deleted" || !ativa) {
      db.prepare(
        `UPDATE usuarios SET plano = 'free', stripe_subscription_id = NULL,
          plano_expira_em = NULL, atualizado_em = CURRENT_TIMESTAMP
         WHERE stripe_subscription_id = ?`,
      ).run(subscriptionId);
    } else {
      db.prepare(
        `UPDATE usuarios SET plano_expira_em = ?, atualizado_em = CURRENT_TIMESTAMP
         WHERE stripe_subscription_id = ?`,
      ).run(expira, subscriptionId);
    }
    return { ok: true };
  }

  return { ok: true, motivo: "evento ignorado" };
}

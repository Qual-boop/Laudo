import db from "@/lib/db";
import { definirPlano } from "@/lib/usuarios";
import type { Plano } from "@/lib/planos";

/**
 * Assinaturas via Asaas (Checkout recorrente + webhook).
 * Sem SDK — tudo passa por lib/asaas.ts (fetch puro).
 */

export type PlanoPago = Exclude<Plano, "free">;
export type Periodo = "mensal" | "anual";

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
  asaas_subscription_id: string | null;
}): ItemAssinatura {
  const plano =
    usuario.plano === "pro" || usuario.plano === "team" ? usuario.plano : "free";
  const expira = usuario.plano_expira_em;
  const expirado = !!expira && new Date(expira).getTime() < Date.now();

  if (plano !== "free" && expirado) {
    // Downgrade preguiçoso com limpeza: sem isso, expira passado e
    // subscription antiga ficavam no banco para sempre (e todo request
    // repetia o UPDATE). O id da assinatura é mantido para permitir
    // conciliação/cancelamento no Asaas.
    db.prepare(
      `UPDATE usuarios SET plano = 'free', plano_expira_em = NULL,
        assinatura_status = 'expirada',
        atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`,
    ).run(usuario.id);
    return { plano: "free", expiraEm: null, subscriptionId: usuario.asaas_subscription_id, trial: false };
  }

  return {
    plano,
    expiraEm: expira,
    subscriptionId: usuario.asaas_subscription_id,
    trial: plano !== "free" && !usuario.asaas_subscription_id,
  };
}

export function precoPara(_plano: PlanoPago, _periodo: Periodo): null {
  // Legado (price IDs do provedor anterior). No Asaas o valor vai no payload
  // do checkout (ver VALORES em lib/asaas.ts) — nada a resolver aqui.
  return null;
}

type EventoAsaas = {
  id: string;
  event: string;
  checkout?: { id?: string; customer?: string; externalReference?: string };
  subscription?: { id?: string; customer?: string; cycle?: string };
  payment?: { id?: string; subscription?: string };
};

function planoDaReferencia(ref: string | undefined): PlanoPago | null {
  const parte = (ref ?? "").split(":")[1];
  return parte === "pro" || parte === "team" ? parte : null;
}

function usuarioDaReferencia(ref: string | undefined): number | null {
  const id = Number((ref ?? "").split(":")[0]);
  return Number.isInteger(id) ? id : null;
}

function buscarPorCustomer(customer: string | undefined): number | null {
  if (!customer) return null;
  const linha = db
    .prepare("SELECT id FROM usuarios WHERE asaas_customer_id = ?")
    .get(customer) as { id: number } | undefined;
  return linha ? linha.id : null;
}

function cicloDaReferencia(ref: string | undefined): "YEARLY" | "MONTHLY" {
  return (ref ?? "").split(":")[2] === "anual" ? "YEARLY" : "MONTHLY";
}

function estenderExpira(usuarioId: number, ciclo: string | undefined): void {
  const dias = ciclo === "YEARLY" ? 365 : 30;
  const atual = db
    .prepare("SELECT plano_expira_em FROM usuarios WHERE id = ?")
    .get(usuarioId) as { plano_expira_em: string | null };
  const base = Math.max(
    Date.now(),
    atual?.plano_expira_em ? new Date(atual.plano_expira_em).getTime() : 0,
  );
  const nova = new Date(base + dias * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    "UPDATE usuarios SET plano_expira_em = ?, assinatura_status = 'ativa', atualizado_em = CURRENT_TIMESTAMP WHERE id = ?",
  ).run(nova, usuarioId);
}

/**
 * Aplica eventos do webhook com idempotência (tabela webhook_eventos).
 * Retorna sempre para a rota responder 200 (o Asaas reenvia qualquer
 * outro status). `aplicado=false` = ignorado por regra, não por erro.
 */
export function aplicarEventoAsaas(evento: EventoAsaas): {
  ok: boolean;
  aplicado: boolean;
  motivo?: string;
} {
  if (!evento.id || !evento.event) {
    return { ok: false, aplicado: false, motivo: "evento sem id/tipo" };
  }

  try {
    db.prepare(
      "INSERT INTO webhook_eventos (id, evento, payload) VALUES (?, ?, ?)",
    ).run(evento.id, evento.event, JSON.stringify(evento));
  } catch {
    return { ok: true, aplicado: false, motivo: "evento já processado" };
  }

  const { event } = evento;

  if (event === "CHECKOUT_PAID") {
    const ref = evento.checkout?.externalReference;
    const usuarioId =
      usuarioDaReferencia(ref) ?? buscarPorCustomer(evento.checkout?.customer);
    const plano = planoDaReferencia(ref);
    if (!usuarioId || !plano) {
      return { ok: true, aplicado: false, motivo: "sem usuario/plano na referência" };
    }
    const ciclo = cicloDaReferencia(ref);
    definirPlano(usuarioId, plano);
    db.prepare(
      `UPDATE usuarios SET assinatura_status = 'ativa', assinatura_ciclo = ?,
        atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`,
    ).run(ciclo, usuarioId);
    estenderExpira(usuarioId, ciclo);
    return { ok: true, aplicado: true };
  }

  if (event === "SUBSCRIPTION_CREATED") {
    const sub = evento.subscription;
    const usuarioId = buscarPorCustomer(sub?.customer);
    if (!usuarioId || !sub?.id) {
      return { ok: true, aplicado: false, motivo: "sem usuario/subscription" };
    }
    db.prepare(
      `UPDATE usuarios SET asaas_subscription_id = ?, assinatura_status = 'ativa',
        atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`,
    ).run(sub.id, usuarioId);
    return { ok: true, aplicado: true };
  }

  if (event === "PAYMENT_RECEIVED") {
    const subId = evento.payment?.subscription;
    if (!subId) {
      return { ok: true, aplicado: false, motivo: "payment sem subscription" };
    }
    const linha = db
      .prepare("SELECT id, assinatura_ciclo FROM usuarios WHERE asaas_subscription_id = ?")
      .get(subId) as { id: number; assinatura_ciclo: string | null } | undefined;
    if (!linha) {
      return { ok: true, aplicado: false, motivo: "subscription desconhecida" };
    }
    // Ciclo gravado no CHECKOUT_PAID; padrão mensal se ausente.
    estenderExpira(linha.id, linha.assinatura_ciclo ?? undefined);
    return { ok: true, aplicado: true };
  }

  if (event === "PAYMENT_OVERDUE") {
    const subId = evento.payment?.subscription ?? evento.subscription?.id;
    if (subId) {
      db.prepare(
        `UPDATE usuarios SET assinatura_status = 'past_due',
          atualizado_em = CURRENT_TIMESTAMP WHERE asaas_subscription_id = ?`,
      ).run(subId);
      return { ok: true, aplicado: true };
    }
    return { ok: true, aplicado: false, motivo: "overdue sem subscription" };
  }

  if (event === "SUBSCRIPTION_DELETED") {
    const subId = evento.subscription?.id;
    if (!subId) {
      return { ok: true, aplicado: false, motivo: "sem subscription id" };
    }
    db.prepare(
      `UPDATE usuarios SET plano = 'free', asaas_subscription_id = NULL,
        plano_expira_em = NULL, assinatura_status = 'cancelada',
        atualizado_em = CURRENT_TIMESTAMP WHERE asaas_subscription_id = ?`,
    ).run(subId);
    return { ok: true, aplicado: true };
  }

  return { ok: true, aplicado: false, motivo: "evento ignorado" };
}

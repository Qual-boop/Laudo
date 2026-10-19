import { buscarUm, executar } from "@/lib/banco";
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
export async function assinaturaDe(usuario: {
  id: number;
  plano: string;
  plano_expira_em: string | null;
  asaas_subscription_id: string | null;
  assinatura_status?: string | null;
}): Promise<ItemAssinatura> {
  const plano =
    usuario.plano === "pro" || usuario.plano === "team" ? usuario.plano : "free";
  const expira = usuario.plano_expira_em;
  const expirado = !!expira && new Date(expira).getTime() < Date.now();

  if (plano !== "free" && expirado) {
    // Downgrade preguiçoso com limpeza: sem isso, expira passado e
    // subscription antiga ficavam no banco para sempre (e todo request
    // repetia o UPDATE). O id da assinatura é mantido para permitir
    // conciliação/cancelamento no Asaas.
    await executar(
      `UPDATE usuarios SET plano = 'free', plano_expira_em = NULL,
        assinatura_status = 'expirada',
        atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`,
      usuario.id,
    );
    return { plano: "free", expiraEm: null, subscriptionId: usuario.asaas_subscription_id, trial: false };
  }

  return {
    plano,
    expiraEm: expira,
    subscriptionId: usuario.asaas_subscription_id,
    // Sem assinatura e sem ter cancelado uma = trial. Cancelada mantém o
    // plano até o fim do período pago, mas não é trial.
    trial:
      plano !== "free" &&
      !usuario.asaas_subscription_id &&
      usuario.assinatura_status !== "cancelada",
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
  payment?: { id?: string; subscription?: string; dueDate?: string };
};

function planoDaReferencia(ref: string | undefined): PlanoPago | null {
  const parte = (ref ?? "").split(":")[1];
  return parte === "pro" || parte === "team" ? parte : null;
}

function usuarioDaReferencia(ref: string | undefined): number | null {
  const id = Number((ref ?? "").split(":")[0]);
  return Number.isInteger(id) ? id : null;
}

async function buscarPorCustomer(customer: string | undefined): Promise<number | null> {
  if (!customer) return null;
  const linha = await buscarUm<{ id: number }>(
    "SELECT id FROM usuarios WHERE asaas_customer_id = ?",
    customer,
  );
  return linha ? linha.id : null;
}

function cicloDaReferencia(ref: string | undefined): "YEARLY" | "MONTHLY" {
  return (ref ?? "").split(":")[2] === "anual" ? "YEARLY" : "MONTHLY";
}

/**
 * Fim do período pago que começa em `inicio`: +1 mês (ou +1 ano) de
 * calendário, como o ciclo do Asaas. `inicio` = vencimento da cobrança
 * ("YYYY-MM-DD", vale até 23:59:59 BRT) ou, sem ele, o instante atual.
 */
export function fimDoPeriodo(ciclo: string | undefined, inicio?: string): Date {
  const meses = ciclo === "YEARLY" ? 12 : 1;
  const venc = /^(\d{4})-(\d{2})-(\d{2})$/.exec(inicio ?? "");
  if (venc) {
    const [, a, m, d] = venc.map(Number);
    // 23:59:59.999 BRT (UTC-3) = 02:59:59.999 UTC do dia seguinte.
    return new Date(Date.UTC(a, m - 1 + meses, d + 1, 2, 59, 59, 999));
  }
  const fim = new Date();
  fim.setUTCMonth(fim.getUTCMonth() + meses);
  return fim;
}

/**
 * Garante o plano coberto até o fim do período pago. Absoluto, não
 * cumulativo: CHECKOUT_PAID e os eventos da 1ª cobrança (CONFIRMED,
 * RECEIVED, em qualquer ordem) cobrem o mesmo período — 1 mês pago
 * vale 1 mês. Antes cada evento somava +30 dias (~60 por 1 mês pago).
 */
async function cobrirPeriodo(
  usuarioId: number,
  ciclo: string | undefined,
  inicio?: string,
): Promise<boolean> {
  const atual = await buscarUm<{ plano_expira_em: string | null }>(
    "SELECT plano_expira_em FROM usuarios WHERE id = ?",
    usuarioId,
  );
  const expiraAtual = atual?.plano_expira_em
    ? new Date(atual.plano_expira_em).getTime()
    : 0;
  const fim = fimDoPeriodo(ciclo, inicio);
  if (fim.getTime() <= expiraAtual) {
    // Pagamento confirma a assinatura (sai de past_due), mas o período
    // já estava coberto: não mexe na expiração.
    await executar(
      "UPDATE usuarios SET assinatura_status = 'ativa', atualizado_em = CURRENT_TIMESTAMP WHERE id = ?",
      usuarioId,
    );
    return false;
  }
  await executar(
    "UPDATE usuarios SET plano_expira_em = ?, assinatura_status = 'ativa', atualizado_em = CURRENT_TIMESTAMP WHERE id = ?",
    fim.toISOString(),
    usuarioId,
  );
  return true;
}

/**
 * Aplica eventos do webhook com idempotência (tabela webhook_eventos).
 * Retorna sempre para a rota responder 200 (o Asaas reenvia qualquer
 * outro status). `aplicado=false` = ignorado por regra, não por erro.
 */
export async function aplicarEventoAsaas(evento: EventoAsaas): Promise<{
  ok: boolean;
  aplicado: boolean;
  motivo?: string;
}> {
  if (!evento.id || !evento.event) {
    return { ok: false, aplicado: false, motivo: "evento sem id/tipo" };
  }

  try {
    await executar(
      "INSERT INTO webhook_eventos (id, evento, payload) VALUES (?, ?, ?)",
      evento.id,
      evento.event,
      JSON.stringify(evento),
    );
  } catch {
    return { ok: true, aplicado: false, motivo: "evento já processado" };
  }

  const { event } = evento;

  if (event === "CHECKOUT_PAID") {
    const ref = evento.checkout?.externalReference;
    const usuarioId =
      usuarioDaReferencia(ref) ?? (await buscarPorCustomer(evento.checkout?.customer));
    const plano = planoDaReferencia(ref);
    if (!usuarioId || !plano) {
      return { ok: true, aplicado: false, motivo: "sem usuario/plano na referência" };
    }
    const ciclo = cicloDaReferencia(ref);
    await definirPlano(usuarioId, plano);
    // assinatura_plano guarda o que foi assinado: o downgrade por expiração
    // zera `plano`, e um pagamento atrasado precisa saber o que devolver.
    await executar(
      `UPDATE usuarios SET assinatura_status = 'ativa', assinatura_ciclo = ?,
        assinatura_plano = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`,
      ciclo,
      plano,
      usuarioId,
    );
    // Sem vencimento no evento: período a partir de agora. Se a 1ª
    // cobrança já tiver coberto (eventos fora de ordem), não soma de novo.
    await cobrirPeriodo(usuarioId, ciclo);
    return { ok: true, aplicado: true };
  }

  if (event === "SUBSCRIPTION_CREATED") {
    const sub = evento.subscription;
    const usuarioId = await buscarPorCustomer(sub?.customer);
    if (!usuarioId || !sub?.id) {
      return { ok: true, aplicado: false, motivo: "sem usuario/subscription" };
    }
    await executar(
      `UPDATE usuarios SET asaas_subscription_id = ?, assinatura_status = 'ativa',
        atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`,
      sub.id,
      usuarioId,
    );
    return { ok: true, aplicado: true };
  }

  // Cartão: CONFIRMED sai na aprovação e RECEIVED só quando o saldo é
  // liberado (~30 dias depois). Os dois cobrem o mesmo período (pelo
  // vencimento), então tratar ambos não soma duas vezes.
  if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
    const subId = evento.payment?.subscription;
    if (!subId) {
      return { ok: true, aplicado: false, motivo: "payment sem subscription" };
    }
    const linha = await buscarUm<{
      id: number;
      plano: string;
      assinatura_ciclo: string | null;
      assinatura_plano: string | null;
    }>(
      "SELECT id, plano, assinatura_ciclo, assinatura_plano FROM usuarios WHERE asaas_subscription_id = ?",
      subId,
    );
    if (!linha) {
      return { ok: true, aplicado: false, motivo: "subscription desconhecida" };
    }
    // Ciclo gravado no CHECKOUT_PAID; padrão mensal se ausente.
    const estendeu = await cobrirPeriodo(
      linha.id,
      linha.assinatura_ciclo ?? undefined,
      evento.payment?.dueDate,
    );
    // Pagamento que chega depois de o plano expirar: o downgrade preguiçoso
    // já tinha zerado `plano` para free. Devolve o plano assinado.
    const assinado = linha.assinatura_plano;
    let restaurou = false;
    if (linha.plano === "free" && (assinado === "pro" || assinado === "team")) {
      await definirPlano(linha.id, assinado);
      restaurou = true;
    }
    return estendeu || restaurou
      ? { ok: true, aplicado: true, ...(restaurou ? { motivo: "plano restaurado" } : {}) }
      : { ok: true, aplicado: false, motivo: "período já coberto" };
  }

  if (event === "PAYMENT_OVERDUE") {
    const subId = evento.payment?.subscription ?? evento.subscription?.id;
    if (subId) {
      await executar(
        `UPDATE usuarios SET assinatura_status = 'past_due',
          atualizado_em = CURRENT_TIMESTAMP WHERE asaas_subscription_id = ?`,
        subId,
      );
      return { ok: true, aplicado: true };
    }
    return { ok: true, aplicado: false, motivo: "overdue sem subscription" };
  }

  if (event === "SUBSCRIPTION_DELETED") {
    const subId = evento.subscription?.id;
    if (!subId) {
      return { ok: true, aplicado: false, motivo: "sem subscription id" };
    }
    await executar(
      `UPDATE usuarios SET plano = 'free', asaas_subscription_id = NULL,
        plano_expira_em = NULL, assinatura_status = 'cancelada',
        assinatura_plano = NULL,
        atualizado_em = CURRENT_TIMESTAMP WHERE asaas_subscription_id = ?`,
      subId,
    );
    return { ok: true, aplicado: true };
  }

  return { ok: true, aplicado: false, motivo: "evento ignorado" };
}

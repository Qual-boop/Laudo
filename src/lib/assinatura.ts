import { buscarUm, executar, transacao } from "@/lib/banco";
import { definirPlano } from "@/lib/usuarios";
import type { Periodo, Plano, PlanoPago } from "@/lib/planos";

/**
 * Assinaturas via Stripe (Checkout recorrente + webhook + portal).
 * Sem SDK — chamadas em lib/stripe.ts.
 */

export type { Periodo, PlanoPago };

export type ItemAssinatura = {
  plano: Plano;
  expiraEm: string | null;
  subscriptionId: string | null;
  trial: boolean;
  status: string | null;
  temPortal: boolean;
};

/** Plano efetivo: pro/team expirado volta a ser free (com downgrade lazy). */
export async function assinaturaDe(usuario: {
  id: number;
  plano: string;
  plano_expira_em: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id?: string | null;
  assinatura_status?: string | null;
}): Promise<ItemAssinatura> {
  const plano =
    usuario.plano === "pro" || usuario.plano === "team" ? usuario.plano : "free";
  const expira = usuario.plano_expira_em;
  const expirado = !!expira && new Date(expira).getTime() < Date.now();
  const temPortal = Boolean(usuario.stripe_customer_id);

  if (plano !== "free" && expirado) {
    // Downgrade preguiçoso com limpeza: sem isso, expira passado ficava no
    // banco para sempre (e todo request repetia o UPDATE). O id da
    // assinatura fica para conciliação no Stripe.
    await executar(
      `UPDATE usuarios SET plano = 'free', plano_expira_em = NULL,
        assinatura_status = 'expirada',
        atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`,
      usuario.id,
    );
    return {
      plano: "free",
      expiraEm: null,
      subscriptionId: usuario.stripe_subscription_id,
      trial: false,
      status: "expirada",
      temPortal,
    };
  }

  return {
    plano,
    expiraEm: expira,
    subscriptionId: usuario.stripe_subscription_id,
    // Sem assinatura e sem ter cancelado uma = trial. Cancelada mantém o
    // plano até o fim do período pago, mas não é trial.
    trial:
      plano !== "free" &&
      !usuario.stripe_subscription_id &&
      usuario.assinatura_status !== "cancelada",
    status: usuario.assinatura_status ?? null,
    temPortal,
  };
}

/* ------------------------------------------------------------------ */
/* Webhook                                                             */
/* ------------------------------------------------------------------ */

type Meta = { usuario_id?: string; plano?: string; periodo?: string };

/** Formato mínimo dos objetos do Stripe que o app lê. */
export type EventoStripe = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

function texto(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

/** Campo pode vir como id ("cus_…") ou objeto expandido ({ id }). */
function idDe(v: unknown): string | null {
  if (typeof v === "string") return v || null;
  if (v && typeof v === "object" && typeof (v as { id?: unknown }).id === "string") {
    return (v as { id: string }).id;
  }
  return null;
}

function planoPago(v: unknown): PlanoPago | null {
  return v === "pro" || v === "team" ? v : null;
}

function periodoDe(v: unknown): Periodo {
  return v === "anual" ? "anual" : "mensal";
}

/** Fim do período a partir de agora (antes de a 1ª fatura informar o real). */
export function fimEstimado(periodo: Periodo, agora = new Date()): Date {
  const fim = new Date(agora);
  fim.setUTCMonth(fim.getUTCMonth() + (periodo === "anual" ? 12 : 1));
  return fim;
}

async function usuarioPor(subscriptionId: string | null, customerId: string | null) {
  type Linha = { id: number; plano: string; assinatura_plano: string | null; plano_expira_em: string | null };
  const sel = "SELECT id, plano, assinatura_plano, plano_expira_em FROM usuarios WHERE";
  if (subscriptionId) {
    const u = await buscarUm<Linha>(`${sel} stripe_subscription_id = ?`, subscriptionId);
    if (u) return u;
  }
  if (customerId) {
    const u = await buscarUm<Linha>(`${sel} stripe_customer_id = ?`, customerId);
    if (u) return u;
  }
  return undefined;
}

/**
 * Estende o plano até `fim` — absoluto, nunca encurta: eventos fora de
 * ordem ou repetidos não somam nem tiram dias.
 */
async function cobrirAte(usuarioId: number, fim: Date, expiraAtual: string | null): Promise<boolean> {
  const atual = expiraAtual ? new Date(expiraAtual).getTime() : 0;
  if (fim.getTime() <= atual) return false;
  await executar(
    "UPDATE usuarios SET plano_expira_em = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?",
    fim.toISOString(),
    usuarioId,
  );
  return true;
}

/** Fim do período pago numa fatura (maior `period.end` das linhas). */
function fimDaFatura(fatura: Record<string, unknown>): Date | null {
  const linhas = (fatura.lines as { data?: { period?: { end?: number } }[] } | undefined)?.data ?? [];
  const fins = linhas.map((l) => l.period?.end).filter((n): n is number => typeof n === "number");
  if (fins.length === 0) return null;
  return new Date(Math.max(...fins) * 1000);
}

/** Assinatura da fatura: campo antigo `subscription` ou o novo `parent`. */
function assinaturaDaFatura(fatura: Record<string, unknown>): { id: string | null; meta: Meta } {
  const pai = (fatura.parent as { subscription_details?: { subscription?: unknown; metadata?: Meta } } | undefined)
    ?.subscription_details;
  const antigo = fatura.subscription_details as { metadata?: Meta } | undefined;
  return {
    id: idDe(fatura.subscription) ?? idDe(pai?.subscription),
    meta: pai?.metadata ?? antigo?.metadata ?? {},
  };
}

export type ResultadoEvento = { ok: boolean; aplicado: boolean; motivo?: string };

/**
 * Aplica um evento do Stripe com idempotência (tabela webhook_eventos) na
 * mesma transação do efeito: se o efeito falhar, o registro do evento
 * também volta e o reenvio do Stripe é processado de novo.
 */
export async function aplicarEventoStripe(evento: EventoStripe): Promise<ResultadoEvento> {
  if (!evento?.id || !evento.type || !evento.data?.object) {
    return { ok: false, aplicado: false, motivo: "evento sem id/tipo" };
  }

  return transacao(async () => {
    const jaVisto = await buscarUm("SELECT id FROM webhook_eventos WHERE id = ?", evento.id);
    if (jaVisto) return { ok: true, aplicado: false, motivo: "evento já processado" };
    await executar(
      "INSERT INTO webhook_eventos (id, evento, payload) VALUES (?, ?, ?)",
      evento.id,
      evento.type,
      // Sem payload completo: ele traz e-mail/nome do cliente (LGPD).
      JSON.stringify({ type: evento.type, objeto: idDe(evento.data.object) }),
    );
    return processar(evento);
  });
}

async function processar(evento: EventoStripe): Promise<ResultadoEvento> {
  const o = evento.data.object;

  if (evento.type === "checkout.session.completed") {
    const meta = (o.metadata ?? {}) as Meta;
    const usuarioId = Number(meta.usuario_id ?? o.client_reference_id);
    const plano = planoPago(meta.plano);
    if (!Number.isInteger(usuarioId) || !plano) {
      return { ok: true, aplicado: false, motivo: "sem usuário/plano nos metadados" };
    }
    if (o.payment_status !== "paid" && o.payment_status !== "no_payment_required") {
      return { ok: true, aplicado: false, motivo: "checkout sem pagamento confirmado" };
    }
    const periodo = periodoDe(meta.periodo);
    await definirPlano(usuarioId, plano);
    await executar(
      `UPDATE usuarios SET stripe_customer_id = COALESCE(?, stripe_customer_id),
        stripe_subscription_id = ?, assinatura_status = 'ativa', assinatura_ciclo = ?,
        assinatura_plano = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`,
      idDe(o.customer),
      idDe(o.subscription),
      periodo,
      plano,
      usuarioId,
    );
    const atual = await buscarUm<{ plano_expira_em: string | null }>(
      "SELECT plano_expira_em FROM usuarios WHERE id = ?",
      usuarioId,
    );
    // Estimativa até a fatura informar o fim real do período.
    await cobrirAte(usuarioId, fimEstimado(periodo), atual?.plano_expira_em ?? null);
    return { ok: true, aplicado: true };
  }

  if (evento.type === "invoice.paid") {
    const { id: subId, meta } = assinaturaDaFatura(o);
    const u = await usuarioPor(subId, idDe(o.customer));
    if (!u) return { ok: true, aplicado: false, motivo: "assinatura desconhecida" };
    const fim = fimDaFatura(o);
    const estendeu = fim ? await cobrirAte(u.id, fim, u.plano_expira_em) : false;
    // Pagamento que chega depois de o plano expirar: o downgrade preguiçoso
    // já tinha zerado `plano`. Devolve o plano assinado.
    const assinado = planoPago(u.assinatura_plano) ?? planoPago(meta.plano);
    let restaurou = false;
    if (u.plano === "free" && assinado) {
      await definirPlano(u.id, assinado);
      restaurou = true;
    }
    await executar(
      `UPDATE usuarios SET assinatura_status = 'ativa',
        stripe_subscription_id = COALESCE(stripe_subscription_id, ?),
        assinatura_plano = COALESCE(assinatura_plano, ?),
        atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`,
      subId,
      assinado,
      u.id,
    );
    return estendeu || restaurou
      ? { ok: true, aplicado: true, ...(restaurou ? { motivo: "plano restaurado" } : {}) }
      : { ok: true, aplicado: false, motivo: "período já coberto" };
  }

  if (evento.type === "invoice.payment_failed") {
    const { id: subId } = assinaturaDaFatura(o);
    const u = await usuarioPor(subId, idDe(o.customer));
    if (!u) return { ok: true, aplicado: false, motivo: "assinatura desconhecida" };
    // Sem bloqueio imediato: o Stripe tenta de novo (Smart Retries) e o
    // plano segue até a data já paga.
    await executar(
      "UPDATE usuarios SET assinatura_status = 'past_due', atualizado_em = CURRENT_TIMESTAMP WHERE id = ?",
      u.id,
    );
    return { ok: true, aplicado: true };
  }

  if (evento.type === "customer.subscription.updated") {
    const subId = idDe(o);
    const u = await usuarioPor(subId, idDe(o.customer));
    if (!u) return { ok: true, aplicado: false, motivo: "assinatura desconhecida" };
    const status =
      o.cancel_at_period_end === true
        ? "cancelada"
        : o.status === "active" || o.status === "trialing"
          ? "ativa"
          : o.status === "past_due" || o.status === "unpaid"
            ? "past_due"
            : null;
    if (!status) return { ok: true, aplicado: false, motivo: `status ${String(o.status)} ignorado` };
    await executar(
      "UPDATE usuarios SET assinatura_status = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?",
      status,
      u.id,
    );
    return { ok: true, aplicado: true };
  }

  if (evento.type === "customer.subscription.deleted") {
    const subId = idDe(o);
    if (!subId) return { ok: true, aplicado: false, motivo: "sem id da assinatura" };
    const n = await executar(
      `UPDATE usuarios SET plano = 'free', stripe_subscription_id = NULL,
        plano_expira_em = NULL, assinatura_status = 'cancelada',
        assinatura_plano = NULL,
        atualizado_em = CURRENT_TIMESTAMP WHERE stripe_subscription_id = ?`,
      subId,
    );
    return n > 0 ? { ok: true, aplicado: true } : { ok: true, aplicado: false, motivo: "assinatura desconhecida" };
  }

  return { ok: true, aplicado: false, motivo: "evento ignorado" };
}

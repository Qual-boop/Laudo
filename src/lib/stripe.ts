import { createHmac, timingSafeEqual } from "node:crypto";
import { PRECOS_CENTAVOS, type Periodo, type PlanoPago } from "@/lib/planos";

/**
 * Cliente HTTP do Stripe (API v1). Sem SDK — fetch com corpo
 * form-urlencoded, como a API espera. Chave: STRIPE_SECRET_KEY
 * (sk_test_… em teste, sk_live_… em produção).
 *
 * Os preços não ficam cadastrados no painel: cada checkout manda o valor
 * (`price_data`) a partir de PRECOS_CENTAVOS em lib/planos.ts — mudar
 * preço é mudar uma constante, sem caçar price IDs.
 */

const BASE = "https://api.stripe.com/v1";

export type ErroStripe = Error & { status?: number };

export function stripeConfigurado(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

/** { a: { b: "1" } } → "a[b]=1" (formato aninhado do Stripe). */
export function codificarForm(dados: Record<string, unknown>, prefixo = ""): string[] {
  const partes: string[] = [];
  for (const [chave, valor] of Object.entries(dados)) {
    if (valor === undefined || valor === null) continue;
    const nome = prefixo ? `${prefixo}[${chave}]` : chave;
    if (Array.isArray(valor)) {
      valor.forEach((item, i) => {
        if (item !== null && typeof item === "object") {
          partes.push(...codificarForm(item as Record<string, unknown>, `${nome}[${i}]`));
        } else {
          partes.push(`${encodeURIComponent(`${nome}[${i}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else if (typeof valor === "object") {
      partes.push(...codificarForm(valor as Record<string, unknown>, nome));
    } else {
      partes.push(`${encodeURIComponent(nome)}=${encodeURIComponent(String(valor))}`);
    }
  }
  return partes;
}

async function chamar<T>(
  metodo: "GET" | "POST" | "DELETE",
  caminho: string,
  dados?: Record<string, unknown>,
): Promise<T> {
  const chave = process.env.STRIPE_SECRET_KEY?.trim();
  if (!chave) {
    const e = new Error("STRIPE_SECRET_KEY não configurada.") as ErroStripe;
    e.status = 500;
    throw e;
  }
  const res = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${chave}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: dados ? codificarForm(dados).join("&") : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const corpo = (await res.json().catch(() => null)) as
    | (T & { error?: { message?: string } })
    | null;
  if (!res.ok) {
    const e = new Error(
      `Stripe: ${corpo?.error?.message ?? `HTTP ${res.status}`}`,
    ) as ErroStripe;
    e.status = res.status;
    throw e;
  }
  return corpo as T;
}

export async function criarCliente(dados: {
  nome: string;
  email: string;
  usuarioId: number;
}): Promise<{ id: string }> {
  return chamar("POST", "/customers", {
    name: dados.nome,
    email: dados.email,
    metadata: { usuario_id: String(dados.usuarioId) },
  });
}

/**
 * Checkout hospedado do Stripe, assinatura recorrente no cartão. Os
 * metadados (usuário, plano, período) voltam no webhook e também ficam na
 * assinatura, para os eventos de renovação.
 */
export async function criarCheckout(p: {
  customerId: string;
  usuarioId: number;
  plano: PlanoPago;
  periodo: Periodo;
  urlSucesso: string;
  urlCancelado: string;
}): Promise<{ id: string; url: string }> {
  const meta = { usuario_id: String(p.usuarioId), plano: p.plano, periodo: p.periodo };
  return chamar("POST", "/checkout/sessions", {
    mode: "subscription",
    customer: p.customerId,
    client_reference_id: String(p.usuarioId),
    locale: "pt-BR",
    allow_promotion_codes: "true",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "brl",
          unit_amount: PRECOS_CENTAVOS[p.plano][p.periodo],
          recurring: { interval: p.periodo === "anual" ? "year" : "month" },
          product_data: {
            name: `Provafix ${p.plano === "pro" ? "Pro" : "Team"} (${p.periodo})`,
          },
        },
      },
    ],
    metadata: meta,
    subscription_data: { metadata: meta },
    success_url: p.urlSucesso,
    cancel_url: p.urlCancelado,
  });
}

/** Portal do cliente: trocar cartão, baixar faturas, cancelar. */
export async function criarPortal(customerId: string, urlRetorno: string): Promise<{ url: string }> {
  return chamar("POST", "/billing_portal/sessions", {
    customer: customerId,
    return_url: urlRetorno,
  });
}

/** Cancela a renovação: o acesso segue até o fim do período já pago. */
export async function cancelarNoFimDoPeriodo(
  subscriptionId: string,
): Promise<{ id: string; cancel_at_period_end: boolean }> {
  return chamar("POST", `/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    cancel_at_period_end: "true",
  });
}

/**
 * Confere o cabeçalho `Stripe-Signature` ("t=…,v1=…"): HMAC-SHA256 com o
 * segredo do webhook (whsec_…) sobre `${t}.${corpo bruto}`. Recusa
 * assinatura velha (> tolerância) para barrar replay.
 */
export function assinaturaWebhookValida(
  corpoBruto: string,
  cabecalho: string | null,
  segredo: string,
  agoraSeg = Math.floor(Date.now() / 1000),
  toleranciaSeg = 300,
): boolean {
  if (!cabecalho || !segredo) return false;
  let t = "";
  const assinaturas: string[] = [];
  for (const parte of cabecalho.split(",")) {
    const [k, v] = parte.split("=", 2).map((s) => s.trim());
    if (k === "t") t = v ?? "";
    if (k === "v1" && v) assinaturas.push(v);
  }
  const ts = Number(t);
  if (!Number.isInteger(ts) || Math.abs(agoraSeg - ts) > toleranciaSeg) return false;
  const esperada = Buffer.from(
    createHmac("sha256", segredo).update(`${t}.${corpoBruto}`).digest("hex"),
    "hex",
  );
  return assinaturas.some((a) => {
    const recebida = Buffer.from(a, "hex");
    return recebida.length === esperada.length && timingSafeEqual(recebida, esperada);
  });
}

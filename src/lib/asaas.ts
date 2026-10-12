/**
 * Cliente HTTP do Asaas (API v3). Sem SDK — fetch puro com a chave em
 * `access_token`. Funciona em Node e Edge (só tipos + fetch).
 *
 * Base: ASAAS_BASE_URL (padrão: sandbox). Chave: ASAAS_API_KEY.
 */

const BASE_PADRAO = "https://api-sandbox.asaas.com/v3";

export function baseAsaas(): string {
  return (process.env.ASAAS_BASE_URL || BASE_PADRAO).replace(/\/+$/, "");
}

function chaveAsaas(): string {
  return process.env.ASAAS_API_KEY ?? "";
}

export type ErroAsaas = Error & { status?: number };

async function chamar<T>(
  metodo: string,
  caminho: string,
  corpo?: unknown,
): Promise<T> {
  const chave = chaveAsaas();
  if (!chave) {
    const e = new Error("ASAAS_API_KEY não configurada.") as ErroAsaas;
    e.status = 500;
    throw e;
  }
  const res = await fetch(`${baseAsaas()}${caminho}`, {
    method: metodo,
    headers: {
      "Content-Type": "application/json",
      access_token: chave,
      "User-Agent": "Laudo/1.0.0",
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal: AbortSignal.timeout(30_000),
  });
  const dados = (await res.json().catch(() => null)) as T | null;
  if (!res.ok) {
    const detalhe =
      (dados as { errors?: { description?: string }[] } | null)?.errors
        ?.map((x) => x.description)
        .filter(Boolean)
        .join(" · ") || `HTTP ${res.status}`;
    const e = new Error(`Asaas: ${detalhe}`) as ErroAsaas;
    e.status = res.status;
    throw e;
  }
  return dados as T;
}

export type AsaasCustomer = { id: string };

export async function criarCliente(dados: {
  name: string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
  mobilePhone?: string;
}): Promise<AsaasCustomer> {
  const corpo: Record<string, string> = { name: dados.name, email: dados.email };
  if (dados.cpfCnpj) corpo.cpfCnpj = dados.cpfCnpj;
  if (dados.phone) corpo.phone = dados.phone;
  if (dados.mobilePhone) corpo.mobilePhone = dados.mobilePhone;
  return chamar<AsaasCustomer>("POST", "/customers", corpo);
}

export type PlanoPago = "pro" | "team";
export type Ciclo = "mensal" | "anual";

export const VALORES: Record<`${PlanoPago}_${Ciclo}`, number> = {
  pro_mensal: 19.9,
  pro_anual: 191.04,
  team_mensal: 49.9,
  team_anual: 479.04,
};

export type AsaasCheckout = { id: string; link?: string };

export async function criarCheckout(params: {
  customerId: string;
  planoCiclo: `${PlanoPago}_${Ciclo}`;
  referencia: string; // "usuarioId:plano:periodo" — volta no webhook
  preencheCliente?: { name: string; email: string };
  successUrl: string;
  cancelUrl: string;
  expiredUrl: string;
}): Promise<AsaasCheckout> {
  const [plano, ciclo] = params.planoCiclo.split("_") as [PlanoPago, Ciclo];
  const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return chamar<AsaasCheckout>("POST", "/checkouts", {
    billingTypes: ["CREDIT_CARD"],
    chargeTypes: ["RECURRENT"],
    minutesToExpire: 60,
    callback: {
      successUrl: params.successUrl,
      cancelUrl: params.cancelUrl,
      expiredUrl: params.expiredUrl,
    },
    ...(params.preencheCliente
      ? { customerData: { name: params.preencheCliente.name, email: params.preencheCliente.email } }
      : {}),
    items: [
      {
        name: `Laudo ${plano} (${ciclo})`,
        description: "Assinatura Laudo",
        quantity: 1,
        value: VALORES[params.planoCiclo],
      },
    ],
    subscription: {
      cycle: ciclo === "mensal" ? "MONTHLY" : "YEARLY",
      nextDueDate: amanha,
    },
    externalReference: params.referencia,
  });
}

export type AsaasSubscription = {
  id: string;
  customer: string;
  status: string;
  cycle?: string;
  nextDueDate?: string | null;
};

export async function buscarAssinatura(id: string): Promise<AsaasSubscription> {
  return chamar<AsaasSubscription>("GET", `/subscriptions/${id}`);
}

export async function cancelarAssinatura(id: string): Promise<void> {
  await chamar<unknown>("DELETE", `/subscriptions/${id}`);
}

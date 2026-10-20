/** Planos e limites — edge-safe (sem import de db): pode usar no client. */

export type Plano = "free" | "pro" | "team";

export type LimitesPlano = {
  relatoriosMes: number; // Infinity = ilimitado
  // Gerações com IA (cada uma gasta tokens pagos). Folga de 2x sobre os
  // relatórios para regerar/ajustar antes de salvar.
  geracoesIaMes: number;
  achadosPorRelatorio: number;
  retestesMes: number;
  exportacaoAvancada: boolean; // Jira/GitHub/CSV
  certificado: boolean;
  marcaDagua: boolean; // "Gerado com Provafix Free" no PDF
  historicoDias: number; // Infinity = ilimitado
  marcaPropria: boolean; // logo e nome da consultoria no PDF
};

export type PlanoPago = Exclude<Plano, "free">;
export type Periodo = "mensal" | "anual";

/**
 * Preços em centavos de real — fonte única: checkout do Stripe, página de
 * preços, landing, perfil e paywall leem daqui. Anual = 12 meses com 20%
 * de desconto.
 */
export const PRECOS_CENTAVOS: Record<PlanoPago, Record<Periodo, number>> = {
  pro: { mensal: 2290, anual: 21984 },
  team: { mensal: 4990, anual: 47904 },
};

/** 2290 → "R$ 22,90". */
export function formatarReais(centavos: number): string {
  return `R$ ${(centavos / 100).toFixed(2).replace(".", ",")}`;
}

/** Preço mensal formatado, ex.: precoMensal("pro") → "R$ 22,90". */
export function precoMensal(plano: PlanoPago): string {
  return formatarReais(PRECOS_CENTAVOS[plano].mensal);
}

export const LIMITES: Record<Plano, LimitesPlano> = {
  free: {
    relatoriosMes: 3,
    geracoesIaMes: 6,
    achadosPorRelatorio: 5,
    retestesMes: 10,
    exportacaoAvancada: false,
    certificado: false,
    marcaDagua: true,
    historicoDias: 30,
    marcaPropria: false,
  },
  pro: {
    relatoriosMes: 300,
    geracoesIaMes: 600,
    achadosPorRelatorio: Infinity,
    retestesMes: Infinity,
    exportacaoAvancada: true,
    certificado: true,
    marcaDagua: false,
    historicoDias: Infinity,
    marcaPropria: true,
  },
  team: {
    relatoriosMes: 900,
    geracoesIaMes: 1800,
    achadosPorRelatorio: Infinity,
    retestesMes: Infinity,
    exportacaoAvancada: true,
    certificado: true,
    marcaDagua: false,
    historicoDias: Infinity,
    marcaPropria: true,
  },
};

export function normalizarPlano(v: unknown): Plano {
  return v === "pro" || v === "team" ? v : "free";
}

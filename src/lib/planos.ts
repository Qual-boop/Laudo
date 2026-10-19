/** Planos e limites — edge-safe (sem import de db): pode usar no client. */

export type Plano = "free" | "pro" | "team";

export type LimitesPlano = {
  relatoriosMes: number; // Infinity = ilimitado
  // Gerações com IA (cada uma gasta tokens pagos). Folga de 2x sobre os
  // relatórios para regerar/ajustar antes de salvar.
  geracoesIaMes: number;
  achadosPorRelatorio: number;
  retestesMes: number;
  exportacaoAvancada: boolean; // Jira/GitHub
  certificado: boolean;
  marcaDagua: boolean; // "Gerado com Provafix Free" no PDF
  historicoDias: number; // Infinity = ilimitado
};

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
  },
};

export function normalizarPlano(v: unknown): Plano {
  return v === "pro" || v === "team" ? v : "free";
}

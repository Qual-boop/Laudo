/** Planos e limites — edge-safe (sem import de db): pode usar no client. */

export type Plano = "free" | "pro" | "team";

export type LimitesPlano = {
  relatoriosMes: number; // Infinity = ilimitado
  achadosPorRelatorio: number;
  retestesMes: number;
  exportacaoAvancada: boolean; // Jira/GitHub
  certificado: boolean;
  marcaDagua: boolean; // "Gerado com Laudo Free" no PDF
  historicoDias: number; // Infinity = ilimitado
};

export const LIMITES: Record<Plano, LimitesPlano> = {
  free: {
    relatoriosMes: 3,
    achadosPorRelatorio: 5,
    retestesMes: 10,
    exportacaoAvancada: false,
    certificado: false,
    marcaDagua: true,
    historicoDias: 30,
  },
  pro: {
    relatoriosMes: Infinity,
    achadosPorRelatorio: Infinity,
    retestesMes: Infinity,
    exportacaoAvancada: true,
    certificado: true,
    marcaDagua: false,
    historicoDias: Infinity,
  },
  team: {
    relatoriosMes: Infinity,
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

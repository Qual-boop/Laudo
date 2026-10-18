import type { Severidade } from "@/lib/tipos";

/**
 * CVSS v3.1 — nota base calculada pela fórmula da especificação FIRST
 * (https://www.first.org/cvss/v3.1/specification-document, seção 7).
 *
 * A IA escreve o vetor; a nota sai daqui. Modelos de linguagem erram a
 * aritmética com frequência ("9.1" para um vetor que dá 8.1), e uma nota
 * que não bate com o vetor é a primeira coisa que um cliente técnico nota.
 */

type Metricas = {
  AV: "N" | "A" | "L" | "P";
  AC: "L" | "H";
  PR: "N" | "L" | "H";
  UI: "N" | "R";
  S: "U" | "C";
  C: "H" | "L" | "N";
  I: "H" | "L" | "N";
  A: "H" | "L" | "N";
};

const VALORES: { [K in keyof Metricas]: readonly Metricas[K][] } = {
  AV: ["N", "A", "L", "P"],
  AC: ["L", "H"],
  PR: ["N", "L", "H"],
  UI: ["N", "R"],
  S: ["U", "C"],
  C: ["H", "L", "N"],
  I: ["H", "L", "N"],
  A: ["H", "L", "N"],
};

const ORDEM = ["AV", "AC", "PR", "UI", "S", "C", "I", "A"] as const;

const PESO_AV = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 };
const PESO_AC = { L: 0.77, H: 0.44 };
const PESO_UI = { N: 0.85, R: 0.62 };
const PESO_CIA = { H: 0.56, L: 0.22, N: 0 };

function pesoPR(pr: Metricas["PR"], escopo: Metricas["S"]): number {
  if (pr === "N") return 0.85;
  if (pr === "L") return escopo === "C" ? 0.68 : 0.62;
  return escopo === "C" ? 0.5 : 0.27;
}

/** Arredondamento para cima da spec 3.1 (Apêndice A), imune a ponto flutuante. */
export function arredondarCima(x: number): number {
  const inteiro = Math.round(x * 100000);
  if (inteiro % 10000 === 0) return inteiro / 100000;
  return (Math.floor(inteiro / 10000) + 1) / 10;
}

/** Lê um vetor 3.0/3.1. Devolve null se faltar métrica base ou houver valor inválido. */
export function lerVetor(vetor: string): Metricas | null {
  const limpo = vetor.trim().replace(/^\(|\)$/g, "");
  const partes = limpo.split("/");
  if (/^CVSS:3\.[01]$/i.test(partes[0] ?? "")) partes.shift();
  const m: Partial<Record<string, string>> = {};
  for (const p of partes) {
    const [chave, valor] = p.split(":");
    if (!chave || !valor) return null;
    m[chave.toUpperCase()] = valor.toUpperCase();
  }
  for (const chave of ORDEM) {
    const v = m[chave];
    if (!v || !(VALORES[chave] as readonly string[]).includes(v)) return null;
  }
  return m as unknown as Metricas;
}

export function vetorCanonico(m: Metricas): string {
  return `CVSS:3.1/${ORDEM.map((k) => `${k}:${m[k]}`).join("/")}`;
}

export function notaBase(m: Metricas): number {
  const iss = 1 - (1 - PESO_CIA[m.C]) * (1 - PESO_CIA[m.I]) * (1 - PESO_CIA[m.A]);
  const impacto =
    m.S === "U" ? 6.42 * iss : 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15);
  const explorabilidade =
    8.22 * PESO_AV[m.AV] * PESO_AC[m.AC] * pesoPR(m.PR, m.S) * PESO_UI[m.UI];
  if (impacto <= 0) return 0;
  return m.S === "U"
    ? arredondarCima(Math.min(impacto + explorabilidade, 10))
    : arredondarCima(Math.min(1.08 * (impacto + explorabilidade), 10));
}

/** Atalho: vetor → { nota, vetor canônico } ou null se o vetor não vale. */
export function calcularCvss(vetor: string): { score: number; vetor: string } | null {
  const m = lerVetor(vetor);
  return m ? { score: notaBase(m), vetor: vetorCanonico(m) } : null;
}

/** Faixas qualitativas da spec 3.1 (0.0 = nenhuma). */
export function severidadeDaNota(score: number): Severidade | null {
  if (score <= 0) return null;
  if (score < 4) return "Baixa";
  if (score < 7) return "Media";
  if (score < 9) return "Alta";
  return "Critica";
}

import type { ResultadoReteste, Severidade, StatusVerificacao } from "@/lib/tipos";

/** Formatação compartilhada do PDF e do resumo executivo (sem I/O). */

/** "2026-10-20" (ou ISO com hora) → "20/10/2026"; texto livre volta igual. */
export function dataBr(v: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (v ?? "");
}

export function cvssTexto(score: number): string {
  return Number.isFinite(score) ? score.toFixed(1) : "N/D";
}

/** Faixa qualitativa do CVSS v3.1 (FIRST). */
export function faixaCvss(score: number): string {
  if (!Number.isFinite(score)) return "—";
  if (score === 0) return "Nenhuma";
  if (score < 4) return "Baixa";
  if (score < 7) return "Média";
  if (score < 9) return "Alta";
  return "Crítica";
}

export const ROTULO_STATUS: Record<StatusVerificacao, string> = {
  pendente: "Aguardando reteste",
  verificado: "Corrigido (verificado)",
  "nao-corrigido": "Não corrigido no reteste",
};

export const ROTULO_RESULTADO: Record<ResultadoReteste, string> = {
  corrigido: "corrigido",
  "nao-corrigido": "não corrigido",
  parcial: "parcialmente corrigido",
};

export const COR_SEVERIDADE: Record<Severidade, string> = {
  Critica: "var(--sev-critica)",
  Alta: "var(--sev-alta)",
  Media: "var(--sev-media)",
  Baixa: "var(--sev-baixa)",
};

/**
 * Texto seguro dentro de `content: "…"` numa folha de estilo inline:
 * escapa aspas, barra invertida e "<" (para nunca fechar o <style>), e
 * achata quebras de linha.
 */
export function cssTexto(s: string): string {
  return `"${s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/</g, "\\3C ")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 140)}"`;
}

/**
 * @page com cabeçalho/rodapé nas margens da folha e "Página X de Y"
 * (margin boxes: Chrome/Edge 131+). A capa (:first) sai limpa.
 */
export function estiloPagina(p: { topoEsquerda: string; topoDireita: string; rodapeEsquerda: string }): string {
  const fonte = "font-family: ui-sans-serif, system-ui, sans-serif; font-size: 7.5pt; color: #64748b;";
  return `@page {
  size: A4;
  margin: 18mm 16mm 18mm;
  @top-left { content: ${cssTexto(p.topoEsquerda)}; ${fonte} }
  @top-right { content: ${cssTexto(p.topoDireita)}; ${fonte} letter-spacing: 0.12em; }
  @bottom-left { content: ${cssTexto(p.rodapeEsquerda)}; ${fonte} }
  @bottom-right { content: "Página " counter(page) " de " counter(pages); ${fonte} }
}
@page :first {
  /* Laterais iguais às das outras páginas: o Chrome diagrama o documento
     inteiro com a largura da 1ª página — capa mais larga cortava o texto
     à direita em todas as seguintes. */
  margin: 12mm 16mm;
  @top-left { content: none; }
  @top-right { content: none; }
  @bottom-left { content: none; }
  @bottom-right { content: none; }
}`;
}

/** Nome de arquivo sugerido ao salvar o PDF ("Pentest-Acme-2026-10-20"). */
export function nomeArquivo(prefixo: string, cliente: string, data: string): string {
  const limpo = cliente
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return [prefixo, limpo || "Cliente", (data || "").slice(0, 10)].filter(Boolean).join("-");
}

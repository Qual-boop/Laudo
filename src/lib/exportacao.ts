import type {
  Achado,
  Capa,
  EscopoMetodologia,
  Relatorio,
  RecomendacaoGeral,
  Severidade,
} from "@/lib/tipos";

export type ExportacaoJira = {
  summary: string;
  description: string;
  issuetype: { name: string };
  labels: string[];
  components?: { name: string }[];
};

export type ExportacaoGitHub = {
  title: string;
  body: string;
  labels: string[];
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function severidadeParaJiraLabel(s: Severidade): string {
  const mapa: Record<Severidade, string> = {
    Critica: "severity-critical",
    Alta: "severity-high",
    Media: "severity-medium",
    Baixa: "severity-low",
  };
  return mapa[s];
}

function severidadeParaGitHubLabel(s: Severidade): string {
  const mapa: Record<Severidade, string> = {
    Critica: "critical",
    Alta: "high",
    Media: "medium",
    Baixa: "low",
  };
  return mapa[s];
}

/* O schema de salvamento aceita relatório/achados parciais (JSON editado à
   mão, importação antiga). Os formatadores abaixo leem tudo por aqui, para
   nunca quebrar com `undefined.toFixed` / `.map` de campo ausente. */
function lista<T>(v: T[] | null | undefined): T[] {
  return Array.isArray(v) ? v : [];
}

function texto(v: unknown, padrao = ""): string {
  return typeof v === "string" ? v : v == null ? padrao : String(v);
}

function cvssDe(achado: Achado): { score: string; vetor: string } {
  const score = typeof achado.cvss?.score === "number" ? achado.cvss.score.toFixed(1) : "N/D";
  const vetor = achado.cvss?.vetor ? ` (${achado.cvss.vetor})` : "";
  return { score, vetor };
}

function formatarAchadoJira(achado: Achado, idx: number): string {
  const { score, vetor } = cvssDe(achado);
  const cwe = achado.cwe ? ` [${achado.cwe}]` : "";
  const owasp = achado.owasp ? ` OWASP: ${achado.owasp}` : "";
  const remediacao = achado.remediacao ?? { curtoPrazo: "", longoPrazo: "", referencias: [] };

  return `
h2. ACHADO ${String(idx + 1).padStart(3, "0")}: ${escapeHtml(texto(achado.titulo, "Achado"))}

*Severidade:* ${texto(achado.severidade, "Não informada")} | *CVSS:* ${score}${vetor}${cwe}${owasp}

h3. Descrição Técnica
${escapeHtml(texto(achado.descricaoTecnica, "Não informado."))}

h3. Impacto no Negócio
${escapeHtml(texto(achado.impactoNegocio, "Não informado."))}

h3. Evidências
{code}
${escapeHtml(achado.evidencias || "Sem evidências informadas.")}
{code}

h3. Passos de Reprodução
${lista(achado.passosReproducao).map((p, i) => `${i + 1}. ${escapeHtml(texto(p))}`).join("\n") || "Não informado."}

h3. Remediação
*Curto prazo:* ${escapeHtml(remediacao.curtoPrazo || "Não informado.")}

*Longo prazo:* ${escapeHtml(remediacao.longoPrazo || "Não informado.")}

*Referências:*
${lista(remediacao.referencias).map((r) => `- ${escapeHtml(texto(r))}`).join("\n") || "Nenhuma referência."}

---
`;
}

function formatarAchadoGitHub(achado: Achado, idx: number): string {
  const { score, vetor } = cvssDe(achado);
  const cwe = achado.cwe ? ` [${achado.cwe}]` : "";
  const owasp = achado.owasp ? ` **OWASP:** ${achado.owasp}` : "";
  const remediacao = achado.remediacao ?? { curtoPrazo: "", longoPrazo: "", referencias: [] };

  return `
## ACHADO ${String(idx + 1).padStart(3, "0")}: ${texto(achado.titulo, "Achado")}

**Severidade:** ${texto(achado.severidade, "Não informada")} | **CVSS:** ${score}${vetor}${cwe}${owasp}

### Descrição Técnica
${texto(achado.descricaoTecnica, "Não informado.")}

### Impacto no Negócio
${texto(achado.impactoNegocio, "Não informado.")}

### Evidências
\`\`\`
${achado.evidencias || "Sem evidências informadas."}
\`\`\`

### Passos de Reprodução
${lista(achado.passosReproducao).map((p, i) => `${i + 1}. ${texto(p)}`).join("\n") || "Não informado."}

### Remediação
**Curto prazo:** ${remediacao.curtoPrazo || "Não informado."}

**Longo prazo:** ${remediacao.longoPrazo || "Não informado."}

**Referências:**
${lista(remediacao.referencias).map((r) => `- ${texto(r)}`).join("\n") || "Nenhuma referência."}

---
`;
}

function formatarRecomendacoesJira(recomendacoes: RecomendacaoGeral[]): string {
  if (!recomendacoes?.length) return "";
  return `
h2. Recomendações Gerais
${recomendacoes
  .map(
    (r, i) =>
      `h3. ${i + 1}. ${escapeHtml(r.recomendacao)} (${r.prioridade})

${escapeHtml(r.justificativa)}`,
  )
  .join("\n\n")}
`;
}

function formatarRecomendacoesGitHub(recomendacoes: RecomendacaoGeral[]): string {
  if (!recomendacoes?.length) return "";
  return `
## Recomendações Gerais
${recomendacoes
  .map(
    (r, i) =>
      `### ${i + 1}. ${r.recomendacao} (${r.prioridade})

${r.justificativa}`,
  )
  .join("\n\n")}
`;
}

/** Relatório com todos os campos que os formatadores leem garantidos. */
function completarParaExportar(relatorio: Relatorio) {
  const capa = relatorio.capa ?? ({} as Partial<Relatorio["capa"]>);
  const sumario = relatorio.sumarioExecutivo ?? ({} as Partial<Relatorio["sumarioExecutivo"]>);
  const escopo = relatorio.escopoMetodologia ?? ({} as Partial<Relatorio["escopoMetodologia"]>);
  const achados = lista(relatorio.achados);
  return {
    capa: {
      titulo: texto(capa.titulo, "Relatório"),
      cliente: texto(capa.cliente, "Cliente"),
      data: texto(capa.data),
      versao: texto(capa.versao, "1.0"),
      classificacao: texto(capa.classificacao, "Confidencial"),
    },
    sumarioExecutivo: {
      visaoGeral: texto(sumario.visaoGeral),
      riscoGeral: texto(sumario.riscoGeral, "Não informado"),
      totalAchados: sumario.totalAchados ?? achados.length,
      resumoPorSeveridade: sumario.resumoPorSeveridade ?? {},
      principaisRiscos: lista(sumario.principaisRiscos),
    },
    escopoMetodologia: {
      escopo: texto(escopo.escopo),
      metodologia: texto(escopo.metodologia),
      ferramentas: lista(escopo.ferramentas),
      limitacoes: texto(escopo.limitacoes),
      periodo: texto(escopo.periodo),
    },
    achados,
    recomendacoesGerais: lista(relatorio.recomendacoesGerais),
    conclusao: texto(relatorio.conclusao),
  };
}

export function gerarExportacaoJira(relatorio: Relatorio): ExportacaoJira {
  const { capa, sumarioExecutivo, escopoMetodologia, achados, recomendacoesGerais, conclusao } =
    completarParaExportar(relatorio);

  const achadosFormatados = achados.map(formatarAchadoJira).join("\n");
  const recomendacoesFormatadas = formatarRecomendacoesJira(recomendacoesGerais);

  const description = `
h1. ${escapeHtml(capa.titulo)}

*Cliente:* ${escapeHtml(capa.cliente)}
*Data:* ${capa.data}
*Versão:* ${capa.versao}
*Classificação:* ${escapeHtml(capa.classificacao)}

h2. Sumário Executivo
${escapeHtml(sumarioExecutivo.visaoGeral)}

*Risco Geral:* ${sumarioExecutivo.riscoGeral}
*Total de Achados:* ${sumarioExecutivo.totalAchados}

*Por Severidade:*
${Object.entries(sumarioExecutivo.resumoPorSeveridade)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n")}

*Principais Riscos:*
${sumarioExecutivo.principaisRiscos.map((r) => `- ${escapeHtml(r)}`).join("\n")}

h2. Escopo e Metodologia
*Escopo:* ${escapeHtml(escopoMetodologia.escopo || "Não informado.")}
*Metodologia:* ${escapeHtml(escopoMetodologia.metodologia || "Não informado.")}
*Ferramentas:* ${escopoMetodologia.ferramentas.join(", ") || "Não informado."}
*Limitações:* ${escapeHtml(escopoMetodologia.limitacoes || "Não informado.")}
*Período:* ${escapeHtml(escopoMetodologia.periodo || "Não informado.")}

h2. Achados
${achadosFormatados}

${recomendacoesFormatadas}

h2. Conclusão
${escapeHtml(conclusao)}

---
*Relatório gerado por Provafix v0.2 — ${new Date().toISOString().split("T")[0]}*
`.trim();

  const labels = ["pentest", "laudo", capa.cliente.toLowerCase().replace(/\s+/g, "-")];
  achados.forEach((a) => labels.push(severidadeParaJiraLabel(a.severidade)));

  return {
    summary: `[Pentest] ${capa.titulo} - ${capa.cliente}`,
    description,
    issuetype: { name: "Task" },
    labels: [...new Set(labels)],
  };
}

export function gerarExportacaoGitHub(relatorio: Relatorio): ExportacaoGitHub {
  const { capa, sumarioExecutivo, escopoMetodologia, achados, recomendacoesGerais, conclusao } =
    completarParaExportar(relatorio);

  const achadosFormatados = achados.map(formatarAchadoGitHub).join("\n");
  const recomendacoesFormatadas = formatarRecomendacoesGitHub(recomendacoesGerais);

  const body = `
# ${capa.titulo}

**Cliente:** ${capa.cliente}
**Data:** ${capa.data}
**Versão:** ${capa.versao}
**Classificação:** ${capa.classificacao}

## Sumário Executivo
${sumarioExecutivo.visaoGeral}

**Risco Geral:** ${sumarioExecutivo.riscoGeral}
**Total de Achados:** ${sumarioExecutivo.totalAchados}

**Por Severidade:**
${Object.entries(sumarioExecutivo.resumoPorSeveridade)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n")}

**Principais Riscos:**
${sumarioExecutivo.principaisRiscos.map((r) => `- ${r}`).join("\n")}

## Escopo e Metodologia
**Escopo:** ${escopoMetodologia.escopo || "Não informado."}
**Metodologia:** ${escopoMetodologia.metodologia || "Não informado."}
**Ferramentas:** ${escopoMetodologia.ferramentas.join(", ") || "Não informado."}
**Limitações:** ${escopoMetodologia.limitacoes || "Não informado."}
**Período:** ${escopoMetodologia.periodo || "Não informado."}

## Achados
${achadosFormatados}

${recomendacoesFormatadas}

## Conclusão
${conclusao}

---
*Relatório gerado por Provafix v0.2 — ${new Date().toISOString().split("T")[0]}*
`.trim();

  const labels = ["pentest", "laudo", capa.cliente.toLowerCase().replace(/\s+/g, "-")];
  achados.forEach((a) => labels.push(severidadeParaGitHubLabel(a.severidade)));

  return {
    title: `[Pentest] ${capa.titulo} - ${capa.cliente}`,
    body,
    labels: [...new Set(labels)],
  };
}

/**
 * Copia para a área de transferência. A Clipboard API só existe em
 * contexto seguro (https/localhost): em http cai para o execCommand, que
 * ainda funciona nos navegadores atuais.
 */
export async function copiarParaClipboard(conteudo: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(conteudo);
      return;
    } catch {
      // permissão negada / contexto inseguro: tenta o fallback abaixo
    }
  }
  const area = document.createElement("textarea");
  area.value = conteudo;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(area);
  if (!ok) throw new Error("Não foi possível copiar.");
}

/**
 * Teto do URL de "nova issue". Acima de ~8 KB o GitHub responde 414 e o
 * Jira corta em silêncio — relatório grande quebrava a exportação (F8).
 */
export const LIMITE_URL = 7_500;

const AVISO_CORTE =
  "\n\n… (texto cortado pelo limite de tamanho do link — o relatório completo foi copiado para a área de transferência; cole aqui)";

/**
 * Monta `base?params` cabendo em LIMITE_URL: se não couber, encurta só o
 * campo longo (busca binária sobre o texto) e acrescenta o aviso de corte.
 */
export function urlComLimite(
  base: string,
  campos: Record<string, string>,
  campoLongo: string,
): { url: string; cortado: boolean } {
  const montar = (valorLongo: string) =>
    `${base}?${new URLSearchParams({ ...campos, [campoLongo]: valorLongo }).toString()}`;
  const completo = campos[campoLongo] ?? "";
  const inteira = montar(completo);
  if (inteira.length <= LIMITE_URL) return { url: inteira, cortado: false };

  let lo = 0;
  let hi = completo.length;
  while (lo < hi) {
    const meio = Math.ceil((lo + hi) / 2);
    if (montar(completo.slice(0, meio) + AVISO_CORTE).length <= LIMITE_URL) lo = meio;
    else hi = meio - 1;
  }
  return { url: montar(completo.slice(0, lo) + AVISO_CORTE), cortado: true };
}

/** Texto simples do relatório inteiro (plano free + clientes sem markdown). */
export function gerarExportacaoTexto(relatorio: Relatorio): string {
  const { capa, sumarioExecutivo, achados, conclusao } = relatorio;
  // O schema de salvamento aceita achados/JSON parciais — o export não pode
  // assumir cvss/severidade presentes (500 em produção antes deste guard).
  const linhas = [
    `${capa.titulo} — ${capa.cliente} (${capa.data})`,
    `Risco geral: ${sumarioExecutivo?.riscoGeral ?? "Não informado"} · ${
      sumarioExecutivo?.totalAchados ?? achados.length
    } achado(s)`,
    "",
    ...achados.map((a, i) => {
      const cvss =
        typeof a.cvss?.score === "number" ? ` (CVSS ${a.cvss.score.toFixed(1)})` : "";
      return `${String(i + 1).padStart(3, "0")} [${a.severidade ?? "Não informada"}] ${a.titulo ?? "Achado"}${cvss}`;
    }),
    "",
    conclusao,
    "",
    "Relatório gerado por Provafix",
  ];
  return linhas.join("\n");
}

/**
 * Abre a issue pré-preenchida. Devolve `cortado: true` quando o texto não
 * coube no link — aí o texto completo vai para a área de transferência.
 */
export async function abrirNovaAbaJira(
  exportacao: ExportacaoJira,
  baseUrl: string,
): Promise<{ cortado: boolean }> {
  const campos: Record<string, string> = {
    summary: exportacao.summary,
    description: exportacao.description,
    issuetype: exportacao.issuetype.name,
    labels: exportacao.labels.join(","),
  };
  if (exportacao.components?.length) {
    campos.components = exportacao.components.map((c) => c.name).join(",");
  }
  const { url, cortado } = urlComLimite(
    `${baseUrl.replace(/\/$/, "")}/secure/CreateIssueDetails!default.jspa`,
    campos,
    "description",
  );
  // noopener+noreferrer: sem isso a aba aberta acessa window.opener (tabnabbing).
  window.open(url, "_blank", "noopener,noreferrer");
  if (cortado) await copiarParaClipboard(exportacao.description).catch(() => {});
  return { cortado };
}

export async function abrirNovaAbaGitHub(
  exportacao: ExportacaoGitHub,
  repoUrl: string,
): Promise<{ cortado: boolean }> {
  const { url, cortado } = urlComLimite(
    `${repoUrl.replace(/\/$/, "")}/issues/new`,
    { title: exportacao.title, body: exportacao.body, labels: exportacao.labels.join(",") },
    "body",
  );
  window.open(url, "_blank", "noopener,noreferrer");
  if (cortado) await copiarParaClipboard(exportacao.body).catch(() => {});
  return { cortado };
}

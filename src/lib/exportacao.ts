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

function formatarAchadoJira(achado: Achado, idx: number): string {
  const vetor = achado.cvss.vetor ? ` (${achado.cvss.vetor})` : "";
  const cwe = achado.cwe ? ` [${achado.cwe}]` : "";
  const owasp = achado.owasp ? ` OWASP: ${achado.owasp}` : "";

  return `
h2. ACHADO ${String(idx + 1).padStart(3, "0")}: ${escapeHtml(achado.titulo)}

*Severidade:* ${achado.severidade} | *CVSS:* ${achado.cvss.score.toFixed(1)}${vetor}${cwe}${owasp}

h3. Descrição Técnica
${escapeHtml(achado.descricaoTecnica)}

h3. Impacto no Negócio
${escapeHtml(achado.impactoNegocio)}

h3. Evidências
{code}
${escapeHtml(achado.evidencias || "Sem evidências informadas.")}
{code}

h3. Passos de Reprodução
${achado.passosReproducao.map((p, i) => `${i + 1}. ${escapeHtml(p)}`).join("\n") || "Não informado."}

h3. Remediação
*Curto prazo:* ${escapeHtml(achado.remediacao.curtoPrazo || "Não informado.")}

*Longo prazo:* ${escapeHtml(achado.remediacao.longoPrazo || "Não informado.")}

*Referências:*
${achado.remediacao.referencias.map((r) => `- ${escapeHtml(r)}`).join("\n") || "Nenhuma referência."}

---
`;
}

function formatarAchadoGitHub(achado: Achado, idx: number): string {
  const vetor = achado.cvss.vetor ? ` (${achado.cvss.vetor})` : "";
  const cwe = achado.cwe ? ` [${achado.cwe}]` : "";
  const owasp = achado.owasp ? ` **OWASP:** ${achado.owasp}` : "";

  return `
## ACHADO ${String(idx + 1).padStart(3, "0")}: ${achado.titulo}

**Severidade:** ${achado.severidade} | **CVSS:** ${achado.cvss.score.toFixed(1)}${vetor}${cwe}${owasp}

### Descrição Técnica
${achado.descricaoTecnica}

### Impacto no Negócio
${achado.impactoNegocio}

### Evidências
\`\`\`
${achado.evidencias || "Sem evidências informadas."}
\`\`\`

### Passos de Reprodução
${achado.passosReproducao.map((p, i) => `${i + 1}. ${p}`).join("\n") || "Não informado."}

### Remediação
**Curto prazo:** ${achado.remediacao.curtoPrazo || "Não informado."}

**Longo prazo:** ${achado.remediacao.longoPrazo || "Não informado."}

**Referências:**
${achado.remediacao.referencias.map((r) => `- ${r}`).join("\n") || "Nenhuma referência."}

---
`;
}

function formatarRecomendacoesJira(recomendacoes: RecomendacaoGeral[]): string {
  if (!recomendacoes.length) return "";
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
  if (!recomendacoes.length) return "";
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

export function gerarExportacaoJira(relatorio: Relatorio): ExportacaoJira {
  const { capa, sumarioExecutivo, escopoMetodologia, achados, recomendacoesGerais, conclusao } = relatorio;

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
*Relatório gerado por Laudo v0.2 — ${new Date().toISOString().split("T")[0]}*
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
  const { capa, sumarioExecutivo, escopoMetodologia, achados, recomendacoesGerais, conclusao } = relatorio;

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
*Relatório gerado por Laudo v0.2 — ${new Date().toISOString().split("T")[0]}*
`.trim();

  const labels = ["pentest", "laudo", capa.cliente.toLowerCase().replace(/\s+/g, "-")];
  achados.forEach((a) => labels.push(severidadeParaGitHubLabel(a.severidade)));

  return {
    title: `[Pentest] ${capa.titulo} - ${capa.cliente}`,
    body,
    labels: [...new Set(labels)],
  };
}

export function copiarParaClipboard(texto: string): Promise<void> {
  return navigator.clipboard.writeText(texto);
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
    "Relatório gerado por Laudo",
  ];
  return linhas.join("\n");
}

export function abrirNovaAbaJira(exportacao: ExportacaoJira, baseUrl: string): void {
  const params = new URLSearchParams({
    summary: exportacao.summary,
    description: exportacao.description,
    issuetype: exportacao.issuetype.name,
    labels: exportacao.labels.join(","),
  });
  if (exportacao.components?.length) {
    params.set("components", exportacao.components.map((c) => c.name).join(","));
  }
  // noopener+noreferrer: sem isso a aba aberta acessa window.opener (tabnabbing).
  window.open(`${baseUrl.replace(/\/$/, "")}/secure/CreateIssueDetails!default.jspa?${params.toString()}`, "_blank", "noopener,noreferrer");
}

export function abrirNovaAbaGitHub(exportacao: ExportacaoGitHub, repoUrl: string): void {
  const params = new URLSearchParams({
    title: exportacao.title,
    body: exportacao.body,
    labels: exportacao.labels.join(","),
  });
  window.open(`${repoUrl.replace(/\/$/, "")}/issues/new?${params.toString()}`, "_blank", "noopener,noreferrer");
}

import { XMLParser } from "fast-xml-parser";
import type { AchadoEntrada, Confianca, Severidade } from "@/lib/tipos";

/**
 * Importação de scanners: Nessus (.nessus), Burp Suite (XML de issues) e
 * OWASP ZAP (relatório JSON ou XML) viram achados do formulário.
 *
 * O mesmo problema em vários alvos vira UM achado com a lista de locais —
 * é assim que um relatório de pentest agrupa, não um por host.
 * Itens informativos são descartados; achados de scanner entram com
 * confiança média ou menor: precisam de validação manual.
 *
 * Segurança: o parser não resolve entidades (sem XXE / billion laughs);
 * as entidades básicas de HTML são decodificadas à mão, depois.
 */

export type FormatoScanner = "nessus" | "burp" | "zap" | "sarif";

export const NOME_SCANNER: Record<FormatoScanner, string> = {
  nessus: "Nessus",
  burp: "Burp Suite",
  zap: "OWASP ZAP",
  sarif: "SARIF (análise de código)",
};

export type ResultadoImportacao = {
  formato: FormatoScanner;
  achados: AchadoEntrada[];
  /** Ocorrências lidas (antes de agrupar), sem contar informativas. */
  ocorrencias: number;
  informativosIgnorados: number;
  /** Havia mais grupos que o limite do formulário. */
  truncado: boolean;
};

export const LIMITE_ACHADOS = 50;
const MAX_DESCRICAO = 6000;
const MAX_EVIDENCIA = 6000;
const MAX_LOCAIS = 25;
const MAX_AMOSTRA = 1500;

const RANK: Record<Severidade, number> = { Critica: 0, Alta: 1, Media: 2, Baixa: 3 };
const RANK_CONF: Record<Confianca, number> = { Alta: 0, Media: 1, Baixa: 2 };

type Grupo = {
  titulo: string;
  severidade: Severidade;
  cwe: string;
  descricao: string;
  solucao: string;
  confianca: Confianca;
  origem: string;
  locais: Set<string>;
  amostra: string;
};

/* ------------------------------------------------------------------ *
 * Utilidades
 * ------------------------------------------------------------------ */

const ENTIDADES: Record<string, string> = {
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&amp;": "&",
};

/** HTML do scanner → texto puro legível. */
export function limparHtml(valor: unknown): string {
  const s = texto(valor);
  if (!s) return "";
  // Entidades antes das tags: o Nessus e o ZAP XML trazem HTML escapado
  // (&lt;p&gt;). O &amp; vem por último para não decodificar duas vezes.
  return s
    .replace(/&(lt|gt|quot|#39|apos|nbsp);/g, (m) => ENTIDADES[m] ?? m)
    .replace(/<\s*(br|\/p|\/li|\/div|\/h\d)\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "- ")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "string") return valor;
  if (typeof valor === "number" || typeof valor === "boolean") return String(valor);
  if (typeof valor === "object" && "#text" in (valor as Record<string, unknown>)) {
    return texto((valor as Record<string, unknown>)["#text"]);
  }
  return "";
}

function lista<T = unknown>(valor: unknown): T[] {
  if (valor === null || valor === undefined || valor === "") return [];
  return (Array.isArray(valor) ? valor : [valor]) as T[];
}

function truncar(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

function cweDe(valor: unknown): string {
  const m = texto(valor).match(/(?:CWE-)?(\d{1,5})/i);
  return m && Number(m[1]) > 0 ? `CWE-${Number(m[1])}` : "";
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: false,
  htmlEntities: false,
  trimValues: true,
  isArray: (nome: string) =>
    ["ReportHost", "ReportItem", "issue", "site", "alertitem", "instance", "cwe"].includes(nome),
});

function agrupar(
  grupos: Map<string, Grupo>,
  chave: string,
  base: Omit<Grupo, "locais" | "amostra">,
  local: string,
  amostra: string,
) {
  const g = grupos.get(chave);
  if (!g) {
    grupos.set(chave, { ...base, locais: new Set(local ? [local] : []), amostra });
    return;
  }
  if (local) g.locais.add(local);
  if (!g.amostra && amostra) g.amostra = amostra;
  if (RANK[base.severidade] < RANK[g.severidade]) g.severidade = base.severidade;
  if (RANK_CONF[base.confianca] < RANK_CONF[g.confianca]) g.confianca = base.confianca;
}

function paraAchados(grupos: Map<string, Grupo>): { achados: AchadoEntrada[]; truncado: boolean } {
  const ordenados = [...grupos.values()].sort(
    (a, b) => RANK[a.severidade] - RANK[b.severidade] || b.locais.size - a.locais.size,
  );
  const achados = ordenados.slice(0, LIMITE_ACHADOS).map((g): AchadoEntrada => {
    const locais = [...g.locais];
    const listados = locais.slice(0, MAX_LOCAIS).map((l) => `- ${l}`);
    if (locais.length > MAX_LOCAIS) listados.push(`- … e mais ${locais.length - MAX_LOCAIS}`);
    const evidencia = [
      `Fonte: ${g.origem}`,
      locais.length
        ? `Afeta ${locais.length} ${locais.length === 1 ? "local" : "locais"}:\n${listados.join("\n")}`
        : "",
      g.amostra ? `Saída do scanner:\n${truncar(g.amostra, MAX_AMOSTRA)}` : "",
      "Validar manualmente antes da entrega (achado importado de scanner).",
    ]
      .filter(Boolean)
      .join("\n\n");
    const descricao = [g.descricao, g.solucao ? `Correção sugerida pelo scanner: ${g.solucao}` : ""]
      .filter(Boolean)
      .join("\n\n");
    return {
      titulo: truncar(g.titulo, 500),
      severidade: g.severidade,
      cwe: g.cwe,
      descricao: truncar(descricao, MAX_DESCRICAO),
      evidencia: truncar(evidencia, MAX_EVIDENCIA),
      confianca: g.confianca,
      dataRetesteSugerida: "",
    };
  });
  return { achados, truncado: ordenados.length > LIMITE_ACHADOS };
}

/* ------------------------------------------------------------------ *
 * Detecção
 * ------------------------------------------------------------------ */

export function detectarFormato(conteudo: string): FormatoScanner | null {
  const inicio = conteudo.slice(0, 4000);
  if (/<NessusClientData_v2[\s>]/.test(inicio)) return "nessus";
  if (/<OWASPZAPReport[\s>]/.test(inicio)) return "zap";
  if (/^\s*\{/.test(inicio) && /"runs"\s*:/.test(conteudo) && /sarif|"version"\s*:\s*"2\.1\.0"/i.test(inicio)) return "sarif";
  if (/^\s*\{/.test(inicio) && /"site"\s*:/.test(conteudo) && /"alerts"\s*:/.test(conteudo)) return "zap";
  if (/<issues[\s>]/.test(inicio) && /<issue>/.test(conteudo)) return "burp";
  return null;
}

/* ------------------------------------------------------------------ *
 * Nessus
 * ------------------------------------------------------------------ */

const SEV_NESSUS: Record<string, Severidade> = { "4": "Critica", "3": "Alta", "2": "Media", "1": "Baixa" };

function importarNessus(xml: string): Omit<ResultadoImportacao, "formato"> {
  const doc = parser.parse(xml) as Record<string, any>;
  const hosts = lista<Record<string, any>>(doc?.NessusClientData_v2?.Report?.ReportHost);
  const grupos = new Map<string, Grupo>();
  let ocorrencias = 0;
  let informativos = 0;

  for (const host of hosts) {
    const nomeHost = texto(host["@_name"]);
    for (const item of lista<Record<string, any>>(host.ReportItem)) {
      const severidade = SEV_NESSUS[texto(item["@_severity"])];
      if (!severidade) {
        informativos++;
        continue;
      }
      ocorrencias++;
      const plugin = texto(item["@_pluginID"]);
      const porta = texto(item["@_port"]);
      const protocolo = texto(item["@_protocol"]);
      const local = porta && porta !== "0" ? `${nomeHost}:${porta}/${protocolo}` : nomeHost;
      agrupar(
        grupos,
        `nessus:${plugin}`,
        {
          titulo: limparHtml(item["@_pluginName"]) || limparHtml(item.synopsis) || `Plugin Nessus ${plugin}`,
          severidade,
          cwe: lista(item.cwe).map(cweDe).find(Boolean) ?? "",
          descricao: limparHtml(item.description) || limparHtml(item.synopsis),
          solucao: limparHtml(item.solution),
          confianca: "Media",
          origem: `Nessus (plugin ${plugin})`,
        },
        local,
        limparHtml(item.plugin_output),
      );
    }
  }
  return { ...paraAchados(grupos), ocorrencias, informativosIgnorados: informativos };
}

/* ------------------------------------------------------------------ *
 * Burp Suite (Issues → Report → XML)
 * ------------------------------------------------------------------ */

const SEV_BURP: Record<string, Severidade> = { high: "Alta", medium: "Media", low: "Baixa" };
const CONF_BURP: Record<string, Confianca> = { certain: "Alta", firm: "Media", tentative: "Baixa" };

function importarBurp(xml: string): Omit<ResultadoImportacao, "formato"> {
  const doc = parser.parse(xml) as Record<string, any>;
  const issues = lista<Record<string, any>>(doc?.issues?.issue);
  const grupos = new Map<string, Grupo>();
  let ocorrencias = 0;
  let informativos = 0;

  for (const issue of issues) {
    const severidade = SEV_BURP[texto(issue.severity).toLowerCase()];
    if (!severidade) {
      informativos++;
      continue;
    }
    ocorrencias++;
    const tipo = texto(issue.type) || texto(issue.name);
    const host = texto(issue.host);
    const caminho = texto(issue.path) || texto(issue.location);
    agrupar(
      grupos,
      `burp:${tipo}`,
      {
        titulo: limparHtml(issue.name) || `Issue Burp ${tipo}`,
        severidade,
        cwe: cweDe(issue.vulnerabilityClassifications),
        descricao: limparHtml(issue.issueBackground) || limparHtml(issue.issueDetail),
        solucao: limparHtml(issue.remediationBackground) || limparHtml(issue.remediationDetail),
        confianca: CONF_BURP[texto(issue.confidence).toLowerCase()] ?? "Media",
        origem: "Burp Suite",
      },
      `${host}${caminho}`,
      limparHtml(issue.issueDetail),
    );
  }
  return { ...paraAchados(grupos), ocorrencias, informativosIgnorados: informativos };
}

/* ------------------------------------------------------------------ *
 * OWASP ZAP (JSON "traditional-json" ou XML)
 * ------------------------------------------------------------------ */

const SEV_ZAP: Record<string, Severidade> = { "3": "Alta", "2": "Media", "1": "Baixa" };
const CONF_ZAP: Record<string, Confianca> = { "4": "Alta", "3": "Alta", "2": "Media", "1": "Baixa" };

function importarZap(conteudo: string): Omit<ResultadoImportacao, "formato"> {
  let sites: Record<string, any>[];
  if (/^\s*\{/.test(conteudo)) {
    const doc = JSON.parse(conteudo) as Record<string, any>;
    sites = lista(doc.site);
  } else {
    const doc = parser.parse(conteudo) as Record<string, any>;
    sites = lista(doc?.OWASPZAPReport?.site);
  }

  const grupos = new Map<string, Grupo>();
  let ocorrencias = 0;
  let informativos = 0;

  for (const site of sites) {
    const alertas = Array.isArray(site.alerts) ? site.alerts : lista(site.alerts?.alertitem);
    for (const alerta of alertas as Record<string, any>[]) {
      const severidade = SEV_ZAP[texto(alerta.riskcode)];
      const confianca = CONF_ZAP[texto(alerta.confidence)];
      if (!severidade || !confianca) {
        // risco informativo ou confiança 0 (falso positivo marcado)
        informativos++;
        continue;
      }
      const instancias = Array.isArray(alerta.instances)
        ? alerta.instances
        : lista(alerta.instances?.instance);
      ocorrencias += Math.max(1, instancias.length);
      const plugin = texto(alerta.pluginid) || texto(alerta.alertRef);
      const base = {
        titulo: limparHtml(alerta.name) || limparHtml(alerta.alert) || `Alerta ZAP ${plugin}`,
        severidade,
        cwe: cweDe(alerta.cweid),
        descricao: limparHtml(alerta.desc),
        solucao: limparHtml(alerta.solution),
        confianca,
        origem: `OWASP ZAP (regra ${plugin})`,
      };
      if (instancias.length === 0) {
        agrupar(grupos, `zap:${plugin}`, base, texto(site["@name"]) || texto(site["@_name"]), "");
      }
      for (const inst of instancias as Record<string, any>[]) {
        const param = texto(inst.param);
        const local = `${texto(inst.method)} ${texto(inst.uri)}${param ? ` [parâmetro: ${param}]` : ""}`.trim();
        agrupar(grupos, `zap:${plugin}`, base, local, texto(inst.evidence));
      }
    }
  }
  return { ...paraAchados(grupos), ocorrencias, informativosIgnorados: informativos };
}

/* ------------------------------------------------------------------ *
 * SARIF 2.1.0 — Semgrep, CodeQL, Trivy, Snyk, Checkmarx, Bandit…
 * ------------------------------------------------------------------ */

const SEV_NIVEL: Record<string, Severidade> = { error: "Alta", warning: "Media", note: "Baixa" };
const CONF_PRECISAO: Record<string, Confianca> = {
  "very-high": "Alta",
  high: "Alta",
  medium: "Media",
  low: "Baixa",
};

/** "security-severity" (CodeQL, Trivy) é uma nota 0–10 no estilo CVSS. */
function severidadeNumerica(v: unknown): Severidade | null {
  const n = Number(texto(v));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 9) return "Critica";
  if (n >= 7) return "Alta";
  if (n >= 4) return "Media";
  return "Baixa";
}

function textoMensagem(v: unknown): string {
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return limparHtml(o.text ?? o.markdown);
  }
  return limparHtml(v);
}

function importarSarif(conteudo: string): Omit<ResultadoImportacao, "formato"> {
  const doc = JSON.parse(conteudo) as Record<string, any>;
  const grupos = new Map<string, Grupo>();
  let ocorrencias = 0;
  let informativos = 0;

  for (const run of lista<Record<string, any>>(doc.runs)) {
    const ferramenta = texto(run?.tool?.driver?.name) || "SARIF";
    const regras = new Map<string, Record<string, any>>();
    for (const r of lista<Record<string, any>>(run?.tool?.driver?.rules)) {
      if (texto(r.id)) regras.set(texto(r.id), r);
    }

    for (const res of lista<Record<string, any>>(run.results)) {
      const idRegra = texto(res.ruleId) || texto(res.rule?.id);
      const regra = regras.get(idRegra) ?? {};
      const props = { ...(regra.properties ?? {}), ...(res.properties ?? {}) } as Record<string, unknown>;
      const nivel = texto(res.level) || texto(regra.defaultConfiguration?.level) || "warning";
      const severidade = severidadeNumerica(props["security-severity"]) ?? SEV_NIVEL[nivel];
      if (!severidade) {
        informativos++;
        continue;
      }
      ocorrencias++;
      const tags = lista<string>(props.tags).map(texto).join(" ");
      const cwe = cweDe((tags.match(/cwe[-/:]?0*(\d{1,5})/i) ?? [])[0] ?? "");
      const loc = lista<Record<string, any>>(res.locations)[0]?.physicalLocation;
      const arquivo = texto(loc?.artifactLocation?.uri);
      const linha = texto(loc?.region?.startLine);
      const descricao = textoMensagem(regra.fullDescription) || textoMensagem(regra.help);
      agrupar(
        grupos,
        `sarif:${ferramenta}:${idRegra}`,
        {
          titulo:
            textoMensagem(regra.shortDescription) || texto(regra.name) || idRegra || `Regra ${ferramenta}`,
          severidade,
          cwe,
          descricao,
          solucao: textoMensagem(regra.help) !== descricao ? textoMensagem(regra.help) : "",
          confianca: CONF_PRECISAO[texto(props.precision).toLowerCase()] ?? "Media",
          origem: `${ferramenta} (regra ${idRegra})`,
        },
        arquivo ? `${arquivo}${linha ? `:${linha}` : ""}` : "",
        textoMensagem(res.message),
      );
    }
  }
  return { ...paraAchados(grupos), ocorrencias, informativosIgnorados: informativos };
}

/* ------------------------------------------------------------------ *
 * Entrada pública
 * ------------------------------------------------------------------ */

export class ErroImportacao extends Error {}

export function importarScanner(conteudo: string): ResultadoImportacao {
  const formato = detectarFormato(conteudo);
  if (!formato) {
    throw new ErroImportacao(
      "Formato não reconhecido. Envie um .nessus (Nessus), o XML de issues do Burp Suite, o relatório JSON/XML do OWASP ZAP ou um .sarif (Semgrep, CodeQL, Trivy, Snyk…).",
    );
  }
  try {
    const r =
      formato === "nessus"
        ? importarNessus(conteudo)
        : formato === "burp"
          ? importarBurp(conteudo)
          : formato === "sarif"
            ? importarSarif(conteudo)
            : importarZap(conteudo);
    return { formato, ...r };
  } catch (e) {
    if (e instanceof ErroImportacao) throw e;
    if (e instanceof Error && /external entit/i.test(e.message)) {
      throw new ErroImportacao(
        "O arquivo declara entidades XML externas (padrão de ataque XXE) e foi recusado por segurança.",
      );
    }
    throw new ErroImportacao(`Não foi possível ler o arquivo do ${NOME_SCANNER[formato]}: ele parece corrompido ou incompleto.`);
  }
}

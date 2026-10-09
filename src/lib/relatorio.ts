import type {
  Achado,
  AchadoEntrada,
  Relatorio,
  RelatorioEntrada,
  RecomendacaoGeral,
  RiscoGeral,
  Severidade,
} from "@/lib/tipos";

/* ============================================================
   Coerção de valores vindos da IA
   A IA pode devolver campos faltando, null, tipos trocados ou
   strings informais. Nada disso pode chegar na tela.
   ============================================================ */

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function txt(v: unknown, padrao = ""): string {
  let s = "";
  if (typeof v === "string") s = v;
  else if (typeof v === "number" || typeof v === "boolean") s = String(v);
  s = s.trim();
  // String vazia também precisa cair no padrão — senão "" anula o fallback.
  return s.length > 0 ? s : padrao;
}

function numero(v: unknown, padrao = 0): number {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : padrao;
}

function lista(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((i): i is string => typeof i === "string")
    .map((i) => i.trim())
    .filter((i) => i.length > 0);
}

function mapaSeveridade(v: unknown): Severidade {
  const s = txt(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (/^(crit|critical|critica|critical|urgente|blocker|p0)/.test(s)) return "Critica";
  if (/^(alt|high|alta|severo|p1)/.test(s)) return "Alta";
  if (/^(med|medium|media|moderad|p2)/.test(s)) return "Media";
  if (/^(baix|low|baixa|informacional|p3|p4)/.test(s)) return "Baixa";
  return "Media";
}

function mapaRisco(v: unknown): RiscoGeral {
  const s = txt(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (/^(crit|critical|critico)/.test(s)) return "Critico";
  if (/^(alt|high|alto)/.test(s)) return "Alto";
  if (/^(med|medium|medio|médio)/.test(s)) return "Medio";
  if (/^(baix|low|baixo)/.test(s)) return "Baixo";
  return "Medio";
}

function dataISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ============================================================
   Derivação de campos — fatos que não dependem da IA
   ============================================================ */

export function contarPorSeveridade(achados: Achado[]) {
  const resumo = { critica: 0, alta: 0, media: 0, baixa: 0 };
  for (const a of achados) resumo[a.severidade.toLowerCase() as keyof typeof resumo] += 1;
  return resumo;
}

export function riscoGeralDe(resumo: {
  critica: number;
  alta: number;
  media: number;
  baixa: number;
}): RiscoGeral {
  if (resumo.critica > 0) return "Critico";
  if (resumo.alta > 0) return "Alto";
  if (resumo.media > 0) return "Medio";
  return "Baixo";
}

/* ============================================================
   Normalização da resposta da IA
   ============================================================ */

export function normalizarRelatorio(
  bruto: unknown,
  entrada: RelatorioEntrada,
): Relatorio {
  const r = obj(bruto);
  const capaBruta = obj(r.capa);
  const sumarioBruto = obj(r.sumarioExecutivo);
  const escopoBruto = obj(r.escopoMetodologia);

  const brutos = Array.isArray(r.achados) ? r.achados : [];
  const achados: Achado[] = brutos
    // Entradas null ou primitivas não são achados — descartar, não inventar.
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((a, i) => {
      const cvss = obj(a.cvss);
      const remediacao = obj(a.remediacao);

      return {
        id: txt(a.id) || `FINDING-${String(i + 1).padStart(3, "0")}`,
        titulo: txt(a.titulo, "Achado sem título"),
        severidade: mapaSeveridade(a.severidade),
        cvss: {
          score: Math.min(10, Math.max(0, Number(numero(cvss.score).toFixed(1)))),
          vetor: txt(cvss.vetor),
        },
        cwe: txt(a.cwe),
        owasp: txt(a.owasp),
        descricaoTecnica: txt(a.descricaoTecnica || a.descricao),
        impactoNegocio: txt(a.impactoNegocio || a.impacto),
        evidencias: txt(a.evidencias || a.evidencia),
        passosReproducao: lista(a.passosReproducao),
        remediacao: {
          curtoPrazo: txt(remediacao.curtoPrazo),
          longoPrazo: txt(remediacao.longoPrazo),
          referencias: lista(remediacao.referencias),
        },
      };
    });

  // O contador vem dos achados reais, não do que a IA declarou sobre si mesma.
  const resumoPorSeveridade = contarPorSeveridade(achados);

  const recomendacoesBrutas = Array.isArray(r.recomendacoesGerais)
    ? r.recomendacoesGerais
    : [];
  const recomendacoesGerais: RecomendacaoGeral[] = recomendacoesBrutas
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((rec) => ({
      prioridade: mapaSeveridade(rec.prioridade),
      recomendacao: txt(rec.recomendacao),
      justificativa: txt(rec.justificativa),
    }))
    .filter((rec) => rec.recomendacao.length > 0);

  return {
    capa: {
      titulo: txt(capaBruta.titulo, entrada.titulo || "Relatório de Teste de Intrusão"),
      cliente: txt(capaBruta.cliente, entrada.cliente || "Não informado"),
      data: /^\d{4}-\d{2}-\d{2}$/.test(txt(capaBruta.data)) ? txt(capaBruta.data) : dataISO(),
      versao: txt(capaBruta.versao, "1.0"),
      classificacao: txt(capaBruta.classificacao, "Confidencial"),
    },
    sumarioExecutivo: {
      visaoGeral: txt(sumarioBruto.visaoGeral),
      riscoGeral: mapaRisco(sumarioBruto.riscoGeral),
      totalAchados: achados.length,
      resumoPorSeveridade,
      principaisRiscos: lista(sumarioBruto.principaisRiscos),
    },
    escopoMetodologia: {
      escopo: txt(escopoBruto.escopo, entrada.escopo),
      metodologia: txt(
        escopoBruto.metodologia,
        "OWASP Testing Guide v4.2, PTES, NIST SP 800-115",
      ),
      ferramentas: lista(escopoBruto.ferramentas).length
        ? lista(escopoBruto.ferramentas)
        : entrada.ferramentas
            .split(",")
            .map((f) => f.trim())
            .filter(Boolean),
      limitacoes: txt(escopoBruto.limitacoes, entrada.limitacoes),
      periodo: txt(escopoBruto.periodo, entrada.periodo),
    },
    achados,
    recomendacoesGerais,
    conclusao: txt(
      r.conclusao,
      "Conclusão não gerada automaticamente — revisar e reescrever antes de entregar.",
    ),
    disclaimer: txt(
      r.disclaimer,
      "Este relatório é confidencial e destinado exclusivamente ao cliente. Os testes foram realizados com autorização formal. As vulnerabilidades identificadas devem ser corrigidas conforme as recomendações.",
    ),
  };
}

/* ============================================================
   Montagem local (sem IA) — usada quando não há chave ou a
   chamada falha. Produz um relatório completo e utilizável.
   ============================================================ */

const CVSS_ESTIMADO: Record<Severidade, number> = {
  Critica: 9.5,
  Alta: 7.5,
  Media: 5.5,
  Baixa: 3.5,
};

export function relatorioFallback(
  entrada: RelatorioEntrada,
  motivo?: string,
): Relatorio {
  const achados: Achado[] = entrada.achados.map((a, i) => ({
    id: `FINDING-${String(i + 1).padStart(3, "0")}`,
    titulo: a.titulo || "Achado sem título",
    severidade: a.severidade,
    cvss: { score: CVSS_ESTIMADO[a.severidade], vetor: "" },
    cwe: a.cwe,
    owasp: "",
    descricaoTecnica: a.descricao,
    impactoNegocio:
      "Impacto não avaliado automaticamente. Revisar e descrever o impacto para o negócio antes de entregar.",
    evidencias: a.evidencia || "Evidência não fornecida.",
    passosReproducao: [],
    remediacao: {
      curtoPrazo: "Mitigação imediata não definida — revisar manualmente.",
      longoPrazo: "Correção definitiva não definida — revisar manualmente.",
      referencias: a.cwe ? [`CWE-${a.cwe.replace(/^CWE-/i, "")}`] : [],
    },
  }));

  const resumoPorSeveridade = contarPorSeveridade(achados);
  const riscoGeral = riscoGeralDe(resumoPorSeveridade);

  const listaSeveridade = ["critica", "alta", "media", "baixa"] as const;
  const frases = listaSeveridade
    .filter((s) => resumoPorSeveridade[s] > 0)
    .map((s) => `${resumoPorSeveridade[s]} ${s}`);

  const principal = achados.filter((a) => a.severidade === "Critica").length
    ? achados.filter((a) => a.severidade === "Critica")
    : achados.filter((a) => a.severidade === "Alta");

  return {
    capa: {
      titulo: entrada.titulo || "Relatório de Teste de Intrusão",
      cliente: entrada.cliente || "Não informado",
      data: dataISO(),
      versao: "1.0",
      classificacao: "Confidencial",
    },
    sumarioExecutivo: {
      visaoGeral:
        `Foram registrados ${achados.length} achado(s) (${frases.join(", ") || "nenhum"}). ` +
        `O risco geral foi classificado como ${riscoGeral}. ` +
        (motivo
          ? "Relatório montado localmente, sem enriquecimento por IA — o texto precisa de revisão manual."
          : "Revise o conteúdo antes de entregar ao cliente."),
      riscoGeral,
      totalAchados: achados.length,
      resumoPorSeveridade,
      principaisRiscos: principal.length
        ? principal.map((a) => `${a.titulo} (${a.severidade})`)
        : ["Nenhum risco crítico ou alto identificado."],
    },
    escopoMetodologia: {
      escopo: entrada.escopo,
      metodologia: "OWASP Testing Guide v4.2, PTES, NIST SP 800-115",
      ferramentas: entrada.ferramentas
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean),
      limitacoes: entrada.limitacoes,
      periodo: entrada.periodo,
    },
    achados,
    recomendacoesGerais: [],
    conclusao:
      `O teste registrou ${achados.length} achado(s) com risco geral ${riscoGeral}. ` +
      "Recomenda-se tratar primeiro os achados de severidade crítica e alta, " +
      "e revalidar após as correções.",
    disclaimer:
      "Este relatório é confidencial e destinado exclusivamente ao cliente. Os testes foram realizados com autorização formal. As vulnerabilidades identificadas devem ser corrigidas conforme as recomendações.",
  };
}

/* ============================================================
   Prompt
   ============================================================ */

export function montarPrompt(entrada: RelatorioEntrada): string {
  const achados = entrada.achados
    .map(
      (a, i) => `
--- ACHADO ${i + 1} ---
titulo: ${a.titulo || "(não informado)"}
severidade informada pelo pentester: ${a.severidade}
cwe informada: ${a.cwe || "(não informado)"}
descrição: ${a.descricao || "(não informada)"}
evidência: ${a.evidencia || "(não fornecida)"}`,
    )
    .join("\n");

  return `Você é um pentester sênior escrevendo o relatório final que será ENTREGUE AO CLIENTE. Escreva em português do Brasil, com tom técnico e profissional. Não use emojis.

DADOS DO ENGAGEMENT
cliente: ${entrada.cliente || "Não informado"}
título do relatório: ${entrada.titulo || "Relatório de Teste de Intrusão"}
escopo: ${entrada.escopo || "(não informado)"}
período: ${entrada.periodo || "(não informado)"}
ferramentas utilizadas: ${entrada.ferramentas || "(não informadas)"}
limitações: ${entrada.limitacoes || "(não informadas)"}
${achados}

TAREFA
Gere UM relatório de teste de intrusão completo. Produza EXATAMENTE um objeto JSON válido, sem markdown, sem comentários, sem texto antes ou depois, com estas chaves e tipos:

{
  "capa": { "titulo": string, "cliente": string, "data": "YYYY-MM-DD", "versao": string, "classificacao": string },
  "sumarioExecutivo": {
    "visaoGeral": string,
    "riscoGeral": "Critico" | "Alto" | "Medio" | "Baixo",
    "totalAchados": number,
    "resumoPorSeveridade": { "critica": number, "alta": number, "media": number, "baixa": number },
    "principaisRiscos": string[]
  },
  "escopoMetodologia": { "escopo": string, "metodologia": string, "ferramentas": string[], "limitacoes": string, "periodo": string },
  "achados": [{
    "id": "FINDING-001",
    "titulo": string,
    "severidade": "Critica" | "Alta" | "Media" | "Baixa",
    "cvss": { "score": number, "vetor": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H" },
    "cwe": string,
    "owasp": string,
    "descricaoTecnica": string,
    "impactoNegocio": string,
    "evidencias": string,
    "passosReproducao": string[],
    "remediacao": { "curtoPrazo": string, "longoPrazo": string, "referencias": string[] }
  }],
  "recomendacoesGerais": [{ "prioridade": "Alta" | "Media" | "Baixa", "recomendacao": string, "justificativa": string }],
  "conclusao": string,
  "disclaimer": string
}

REGRAS
1. Gere EXATAMENTE ${entrada.achados.length} achado(s) — um para cada entrada acima. Preserve a ordem. Não invente achados que não foram informados e não descarte nenhum.
2. "severidade" e "cwe" devem ser coerentes com o que o pentester informou. Só reclassifique se houver forte evidência na descrição.
3. Calcule o CVSS v3.1 de forma CONSISTENTE com a severidade: score e vetor precisam concordar. Crítica ~9.0-10.0, Alta ~7.0-8.9, Média ~4.0-6.9, Baixa ~0.1-3.9. Explique as métricas no vetor.
4. "owasp" no formato "A03:2021 - Injection" (categoria do OWASP Top 10 2021).
5. "descricaoTecnica" deve explicar a causa raiz, não só repetir a entrada. "impactoNegocio" traduz a falha técnica em risco para o negócio.
6. "passosReproducao": array de strings já numeradas ("1. ...", "2. ..."). Se a evidência não permitir, use a evidência fornecida para deduzir e marque o passo incerto como "(confirmar)".
7. "remediacao.curtoPrazo" = mitigação imediata. "remediacao.longoPrazo" = correção definitiva/preventiva. "referencias" deve citar cheat sheets da OWASP e a página do CWE.
8. "sumarioExecutivo.visaoGeral" em 2-3 frases, para diretoria. "principaisRiscos" são 2 a 4 riscos em linguagem de negócio, não técnico.
9. "recomendacoesGerais": 3 a 5 ações de hardening/prioridade, além das correções dos achados individuais.
10. "disclaimer": confidentialidade, autorização formal e obrigação de correção.
11. Preencha "cliente" com "${entrada.cliente || "Não informado"}" e "data" no formato YYYY-MM-DD.
12. Todo o texto deve ser pronto para entrega: nada de "aqui", "segue", "o modelo", "como exemplo", "sendo o caso".

Responda SOMENTE com o JSON.`;
}

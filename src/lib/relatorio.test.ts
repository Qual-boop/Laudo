import { describe, expect, it } from "vitest";
import {
  contarPorSeveridade,
  lista,
  normalizarRelatorio,
  numero,
  obj,
  relatorioFallback,
  riscoGeralDe,
  txt,
} from "@/lib/relatorio";
import type { RelatorioEntrada } from "@/lib/tipos";

/* ------------------------------------------------------------------ *
 * Coerção de tipos                                                     *
 * ------------------------------------------------------------------ */

describe("txt", () => {
  it("mantém string válida e apara espaços", () => {
    expect(txt("  SQL Injection  ")).toBe("SQL Injection");
  });

  it("cai no padrão quando a string é vazia", () => {
    // Regressão: string vazia anulava o fallback.
    expect(txt("", "1.0")).toBe("1.0");
    expect(txt("   ", "1.0")).toBe("1.0");
  });

  it("cai no padrão para null, undefined e objetos", () => {
    expect(txt(null, "padrão")).toBe("padrão");
    expect(txt(undefined, "padrão")).toBe("padrão");
    expect(txt({}, "padrão")).toBe("padrão");
    expect(txt([], "padrão")).toBe("padrão");
  });

  it("converte número e booleano em string", () => {
    expect(txt(42)).toBe("42");
    expect(txt(0)).toBe("0");
    expect(txt(true)).toBe("true");
  });

  it("não deixa string vazia virar fallback vazio", () => {
    expect(txt("")).toBe("");
    expect(txt(null)).toBe("");
  });
});

describe("lista", () => {
  it("descarta entradas que não são string", () => {
    // Regressão: número virava o texto "5" dentro de uma lista de riscos.
    expect(lista(["a", 5, null, "b", undefined])).toEqual(["a", "b"]);
  });

  it("descarta strings vazias após aparo", () => {
    expect(lista(["a", "", "   ", "b"])).toEqual(["a", "b"]);
  });

  it("devolve [] para valores que não são array", () => {
    expect(lista("Burp, Nmap")).toEqual([]);
    expect(lista(null)).toEqual([]);
    expect(lista({})).toEqual([]);
  });

  it("preserva a ordem dos textos válidos", () => {
    expect(lista(["primeiro", "segundo", "terceiro"])).toEqual([
      "primeiro",
      "segundo",
      "terceiro",
    ]);
  });
});

describe("numero", () => {
  it("converte string numérica com vírgula decimal", () => {
    expect(numero("9,8")).toBe(9.8);
    expect(numero("9.8")).toBe(9.8);
  });

  it("cai no padrão para valores não numéricos", () => {
    expect(numero("abc", 1)).toBe(1);
    expect(numero(null, 2)).toBe(2);
    expect(numero(undefined, 2)).toBe(2);
    expect(numero("", 5)).toBe(5);
    expect(numero(false, 6)).toBe(6);
    expect(numero(NaN, 3)).toBe(3);
    expect(numero(Infinity, 4)).toBe(4);
  });

  it("mantém zero como valor legítimo", () => {
    expect(numero(0, 9)).toBe(0);
    expect(numero("0", 9)).toBe(0);
  });
});

describe("obj", () => {
  it("aceita objeto e rejeita o resto", () => {
    expect(obj({ a: 1 })).toEqual({ a: 1 });
    expect(obj([1, 2])).toEqual({});
    expect(obj(null)).toEqual({});
    expect(obj("texto")).toEqual({});
  });
});

/* ------------------------------------------------------------------ *
 * Derivações                                                           *
 * ------------------------------------------------------------------ */

describe("contarPorSeveridade e riscoGeralDe", () => {
  const base = {
    id: "FINDING-001",
    titulo: "t",
    cvss: { score: 0, vetor: "" },
    cwe: "",
    owasp: "",
    descricaoTecnica: "",
    impactoNegocio: "",
    evidencias: "",
    passosReproducao: [],
    remediacao: { curtoPrazo: "", longoPrazo: "", referencias: [] },
    confianca: "Media" as const,
    dataRetesteSugerida: null,
  };

  it("conta por severidade e ordena o risco", () => {
    const achados = [
      { ...base, severidade: "Critica" as const },
      { ...base, severidade: "Alta" as const },
      { ...base, severidade: "Alta" as const },
      { ...base, severidade: "Baixa" as const },
    ];
    expect(contarPorSeveridade(achados)).toEqual({
      critica: 1,
      alta: 2,
      media: 0,
      baixa: 1,
    });
  });

  it("herda o risco do nível mais alto presente", () => {
    expect(riscoGeralDe({ critica: 1, alta: 3, media: 2, baixa: 9 })).toBe("Critico");
    expect(riscoGeralDe({ critica: 0, alta: 1, media: 2, baixa: 9 })).toBe("Alto");
    expect(riscoGeralDe({ critica: 0, alta: 0, media: 1, baixa: 9 })).toBe("Medio");
    expect(riscoGeralDe({ critica: 0, alta: 0, media: 0, baixa: 0 })).toBe("Baixo");
  });
});

/* ------------------------------------------------------------------ *
 * normalizarRelatorio                                                  *
 * ------------------------------------------------------------------ */

const ENTRADA: RelatorioEntrada = {
  cliente: "Acme Corp",
  titulo: "Relatório de Teste de Intrusão",
  escopo: "Aplicação web",
  periodo: "01/10/2026 a 09/10/2026",
  limitacoes: "Testes não autenticados",
  ferramentas: "Burp Suite, Nmap",
  achados: [
    {
      titulo: "SQL Injection no login",
      severidade: "Critica",
      cwe: "CWE-89",
      descricao: "Input concatenado na query.",
      evidencia: "GET /login?user=admin' OR '1'='1",
      confianca: "Alta",
      dataRetesteSugerida: "2026-11-01",
    },
  ],
};

const JSON_VALIDO = {
  capa: {
    titulo: "Relatório de Teste de Intrusão",
    cliente: "Acme Corp",
    data: "2026-10-09",
    versao: "1.0",
    classificacao: "Confidencial",
  },
  sumarioExecutivo: {
    visaoGeral: "Foi encontrada uma falha crítica de injeção.",
    riscoGeral: "Critico",
    totalAchados: 1,
    resumoPorSeveridade: { critica: 1, alta: 0, media: 0, baixa: 0 },
    principaisRiscos: ["Exposição do banco de dados"],
  },
  escopoMetodologia: {
    escopo: "Aplicação web",
    metodologia: "OWASP Testing Guide v4.2",
    ferramentas: ["Burp Suite", "Nmap"],
    limitacoes: "Testes não autenticados",
    periodo: "01/10/2026 a 09/10/2026",
  },
  achados: [
    {
      id: "FINDING-001",
      titulo: "SQL Injection no login",
      severidade: "Critica",
      cvss: { score: 9.8, vetor: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H" },
      cwe: "CWE-89",
      owasp: "A03:2021 - Injection",
      descricaoTecnica: "O parâmetro user é concatenado sem parametrização.",
      impactoNegocio: "Permite ler o banco inteiro.",
      evidencias: "HTTP/1.1 200 OK",
      passosReproducao: ["1. Acessar /login", "2. Injetar payload"],
      remediacao: {
        curtoPrazo: "Bloquear caracteres especiais no WAF.",
        longoPrazo: "Usar consultas parametrizadas.",
        referencias: ["CWE-89"],
      },
    },
  ],
  recomendacoesGerais: [
    { prioridade: "Alta", recomendacao: "Implementar WAF", justificativa: "Mitiga enquanto corrige." },
  ],
  conclusao: "Recomenda-se corrigir com urgência.",
  disclaimer: "Confidencial.",
};

describe("normalizarRelatorio — JSON válido", () => {
  const r = normalizarRelatorio(JSON_VALIDO, ENTRADA);

  it("preserva todos os campos bem formados", () => {
    expect(r.capa.cliente).toBe("Acme Corp");
    expect(r.capa.data).toBe("2026-10-09");
    expect(r.sumarioExecutivo.riscoGeral).toBe("Critico");
    expect(r.sumarioExecutivo.principaisRiscos).toEqual(["Exposição do banco de dados"]);
    expect(r.escopoMetodologia.ferramentas).toEqual(["Burp Suite", "Nmap"]);
  });

  it("mantém o achado intacto", () => {
    expect(r.achados).toHaveLength(1);
    expect(r.achados[0].id).toBe("FINDING-001");
    expect(r.achados[0].cvss.score).toBe(9.8);
    expect(r.achados[0].passosReproducao).toHaveLength(2);
    expect(r.achados[0].remediacao.referencias).toEqual(["CWE-89"]);
  });

  it("mantém as recomendações", () => {
    expect(r.recomendacoesGerais).toHaveLength(1);
    expect(r.recomendacoesGerais[0].prioridade).toBe("Alta");
  });

  it("devolve exatamente as chaves do contrato", () => {
    expect(Object.keys(r).sort()).toEqual(
      [
        "achados",
        "capa",
        "conclusao",
        "disclaimer",
        "escopoMetodologia",
        "recomendacoesGerais",
        "sumarioExecutivo",
      ].sort(),
    );
  });
});

describe("normalizarRelatorio — entrada degradada", () => {
  it("sobrevive a null/undefined em toda a raiz", () => {
    for (const bruto of [null, undefined, 42, "texto", [], {}]) {
      const r = normalizarRelatorio(bruto, ENTRADA);
      expect(r.achados).toEqual([]);
      expect(r.capa.cliente).toBe("Acme Corp");
      expect(r.disclaimer.length).toBeGreaterThan(0);
      expect(r.conclusao.length).toBeGreaterThan(0);
    }
  });

  it("cai nos padrões quando campos são null", () => {
    const r = normalizarRelatorio(
      {
        capa: { titulo: null, cliente: null, data: null, versao: null, classificacao: null },
        sumarioExecutivo: { visaoGeral: null, riscoGeral: null, principaisRiscos: null },
        escopoMetodologia: { escopo: null, metodologia: null, ferramentas: null, limitacoes: null, periodo: null },
        achados: [],
        recomendacoesGerais: null,
        conclusao: null,
        disclaimer: null,
      },
      ENTRADA,
    );
    expect(r.capa.versao).toBe("1.0");
    expect(r.capa.classificacao).toBe("Confidencial");
    expect(r.sumarioExecutivo.riscoGeral).toBe("Medio");
    expect(r.conclusao).toContain("não gerada");
  });

  it("normaliza severidade com acento, caixa e sinônimos", () => {
    const casos: [string, string][] = [
      ["CRÍTICA", "Critica"],
      ["critica", "Critica"],
      ["critical", "Critica"],
      ["HIGH", "Alta"],
      ["alta", "Alta"],
      ["medium", "Media"],
      ["médio", "Media"],
      ["low", "Baixa"],
      ["P1", "Alta"],
      ["lixo", "Media"],
    ];
    for (const [entrada, esperado] of casos) {
      const r = normalizarRelatorio(
        { achados: [{ titulo: "x", severidade: entrada }] },
        ENTRADA,
      );
      expect(r.achados[0].severidade).toBe(esperado);
    }
  });

  it("descarta entradas null no array de achados", () => {
    // Regressão: null virava um "Achado sem título" fantasma.
    const r = normalizarRelatorio(
      { achados: [null, { titulo: "A" }, "texto", 7, { titulo: "B" }] },
      ENTRADA,
    );
    expect(r.achados).toHaveLength(2);
    expect(r.sumarioExecutivo.totalAchados).toBe(2);
  });

  it("gera id sequencial quando a IA não fornece", () => {
    const r = normalizarRelatorio({ achados: [{ titulo: "A" }, { titulo: "B" }] }, ENTRADA);
    expect(r.achados.map((a) => a.id)).toEqual(["FINDING-001", "FINDING-002"]);
  });

  it("limita o score de CVSS ao intervalo 0–10", () => {
    const r = normalizarRelatorio(
      {
        achados: [
          { titulo: "A", cvss: { score: 99 } },
          { titulo: "B", cvss: { score: -5 } },
          { titulo: "C", cvss: { score: "7.35" } },
          { titulo: "D", cvss: { score: null } },
        ],
      },
      ENTRADA,
    );
    expect(r.achados[0].cvss.score).toBe(10);
    expect(r.achados[1].cvss.score).toBe(0);
    // 7.35 em ponto flutuante é 7,3499... → uma casa decimal arredonda para 7.3
    expect(r.achados[2].cvss.score).toBe(7.3);
    expect(r.achados[3].cvss.score).toBe(0);
  });

  it("corrige data fora do formato ISO", () => {
    const comData = (data: unknown) =>
      normalizarRelatorio({ capa: { data } }, ENTRADA).capa.data;
    expect(comData("09/10/2026")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(comData("ontem")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(comData("2026-10-09")).toBe("2026-10-09");
  });

  it("recalcula contadores a partir dos achados reais", () => {
    // A IA pode declarar números errados; eles não podem chegar à UI.
    const r = normalizarRelatorio(
      {
        sumarioExecutivo: {
          riscoGeral: "Baixo",
          totalAchados: 999,
          resumoPorSeveridade: { critica: 77, alta: 0, media: 0, baixa: 0 },
        },
        achados: [
          { titulo: "A", severidade: "Critica" },
          { titulo: "B", severidade: "Baixa" },
        ],
      },
      ENTRADA,
    );
    expect(r.sumarioExecutivo.totalAchados).toBe(2);
    expect(r.sumarioExecutivo.resumoPorSeveridade).toEqual({
      critica: 1,
      alta: 0,
      media: 0,
      baixa: 1,
    });
    // riscoGeral vem da IA; a UI mostra os contadores derivados ao lado.
    expect(r.sumarioExecutivo.riscoGeral).toBe("Baixo");
  });

  it("filtura recomendações vazias ou malformadas", () => {
    const r = normalizarRelatorio(
      {
        recomendacoesGerais: [
          null,
          { prioridade: "Alta", recomendacao: "", justificativa: "x" },
          { prioridade: "P1", recomendacao: "Ativar MFA" },
        ],
      },
      ENTRADA,
    );
    expect(r.recomendacoesGerais).toHaveLength(1);
    expect(r.recomendacoesGerais[0].prioridade).toBe("Alta");
  });

  it("usa as ferramentas da entrada quando a IA não devolve lista", () => {
    const r = normalizarRelatorio(
      { escopoMetodologia: { ferramentas: "Burp, Nmap" } },
      ENTRADA,
    );
    expect(r.escopoMetodologia.ferramentas).toEqual(["Burp Suite", "Nmap"]);
  });

  it("aceita campos em camelCase alternativos", () => {
    const r = normalizarRelatorio(
      { achados: [{ titulo: "A", descricao: "desc", impacto: "imp", evidencia: "ev" }] },
      ENTRADA,
    );
    expect(r.achados[0].descricaoTecnica).toBe("desc");
    expect(r.achados[0].impactoNegocio).toBe("imp");
    expect(r.achados[0].evidencias).toBe("ev");
  });
});

describe("normalizarRelatorio — JSON truncado", () => {
  it("produz relatório válido quando o parse falha antes do normalizador", () => {
    // O JSON truncado nunca chega ao normalizador: a rota cai no fallback.
    // Aqui verificamos que mesmo um objeto parcial é normalizável.
    const parcial = { capa: { cliente: "Acme" }, achados: [{ titulo: "A" }] };
    const r = normalizarRelatorio(parcial, ENTRADA);
    expect(r.achados).toHaveLength(1);
    expect(r.capa.classificacao).toBe("Confidencial");
    expect(r.disclaimer.length).toBeGreaterThan(0);
  });

  it("não deixa array truncado pela metade quebrar", () => {
    const r = normalizarRelatorio({ achados: [{ titulo: "A", cvss: {} }] }, ENTRADA);
    expect(r.achados[0].cvss).toEqual({ score: 0, vetor: "" });
  });
});

/* ------------------------------------------------------------------ *
 * Fallback local                                                       *
 * ------------------------------------------------------------------ */

describe("relatorioFallback", () => {
  it("monta relatório completo a partir da entrada, sem IA", () => {
    const r = relatorioFallback(ENTRADA, "sem chave");
    expect(r.capa.cliente).toBe("Acme Corp");
    expect(r.achados).toHaveLength(1);
    expect(r.achados[0].id).toBe("FINDING-001");
    expect(r.achados[0].cvss.vetor).toBe("");
    expect(r.sumarioExecutivo.totalAchados).toBe(1);
    expect(r.sumarioExecutivo.riscoGeral).toBe("Critico");
  });

  it("avisa explicitamente que o relatório não foi enriquecido por IA", () => {
    const r = relatorioFallback(ENTRADA, "sem chave");
    expect(r.sumarioExecutivo.visaoGeral).toContain("montado localmente");
  });

  it("usa 'Não informado' quando o cliente não foi informado", () => {
    const r = relatorioFallback({ ...ENTRADA, cliente: "" });
    expect(r.capa.cliente).toBe("Não informado");
  });

  it("gera id sequencial e CVSS estimado por severidade", () => {
    const r = relatorioFallback({
      ...ENTRADA,
      achados: [
        { ...ENTRADA.achados[0], titulo: "A", severidade: "Critica" },
        { ...ENTRADA.achados[0], titulo: "B", severidade: "Baixa" },
      ],
    });
    expect(r.achados.map((a) => a.id)).toEqual(["FINDING-001", "FINDING-002"]);
    expect(r.achados[0].cvss.score).toBeGreaterThan(r.achados[1].cvss.score);
  });

  it("devolve todas as chaves do contrato mesmo sem entrada", () => {
    const r = relatorioFallback({
      cliente: "",
      titulo: "",
      escopo: "",
      periodo: "",
      limitacoes: "",
      ferramentas: "",
      achados: [],
    });
    expect(Object.keys(r).sort()).toEqual(
      [
        "achados",
        "capa",
        "conclusao",
        "disclaimer",
        "escopoMetodologia",
        "recomendacoesGerais",
        "sumarioExecutivo",
      ].sort(),
    );
    expect(r.sumarioExecutivo.riscoGeral).toBe("Baixo");
    expect(r.escopoMetodologia.ferramentas).toEqual([]);
  });
});

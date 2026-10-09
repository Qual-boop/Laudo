import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/gerar/route";
import type { NextRequest } from "next/server";
import type { Relatorio } from "@/lib/tipos";

/* ------------------------------------------------------------------ *
 * Utilidades                                                           *
 * ------------------------------------------------------------------ */

const ENTRADA = {
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
    },
  ],
};

function requisicao(body: unknown): NextRequest {
  return new Request("http://localhost/api/gerar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

/** Envolve um payload de chat completion da OpenAI. */
function respostaIA(content: string, status = 200): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Relatório que a IA "deveria" devolver. */
const RELATORIO_IA = {
  capa: { titulo: "Relatório", cliente: "Acme Corp", data: "2026-10-09", versao: "1.0", classificacao: "Confidencial" },
  sumarioExecutivo: {
    visaoGeral: "Uma falha crítica.",
    riscoGeral: "Critico",
    totalAchados: 1,
    resumoPorSeveridade: { critica: 1, alta: 0, media: 0, baixa: 0 },
    principaisRiscos: ["Exposição de dados"],
  },
  escopoMetodologia: {
    escopo: "Aplicação web",
    metodologia: "OWASP Testing Guide v4.2",
    ferramentas: ["Burp Suite"],
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
      descricaoTecnica: "Sem parametrização.",
      impactoNegocio: "Leitura do banco.",
      evidencias: "HTTP/1.1 200 OK",
      passosReproducao: ["1. Acessar /login"],
      remediacao: { curtoPrazo: "WAF", longoPrazo: "Query parametrizada", referencias: ["CWE-89"] },
    },
  ],
  recomendacoesGerais: [],
  conclusao: "Corrigir com urgência.",
  disclaimer: "Confidencial.",
};

function contratoCompleto(r: Relatorio): boolean {
  return (
    !!r.capa &&
    !!r.sumarioExecutivo &&
    !!r.escopoMetodologia &&
    Array.isArray(r.achados) &&
    Array.isArray(r.recomendacoesGerais) &&
    typeof r.conclusao === "string" &&
    typeof r.disclaimer === "string"
  );
}

const ehFallback = (r: Relatorio) =>
  r.sumarioExecutivo.visaoGeral.includes("montado localmente");

/* ------------------------------------------------------------------ *
 * Setup                                                                *
 * ------------------------------------------------------------------ */

let silenciado: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  silenciado = vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("OPENAI_BASE_URL", "https://api.groq.com/openai/v1");
  vi.stubEnv("OPENAI_API_KEY", "chave-de-teste");
});

afterEach(() => {
  silenciado.mockRestore();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ *
 * Validação de entrada (ocorre antes de qualquer chamada externa)     *
 * ------------------------------------------------------------------ */

describe("POST /api/gerar — validação de entrada", () => {
  it("rejeita lista de achados vazia com 400", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(requisicao({ ...ENTRADA, achados: [] }));
    const corpo = await res.json();

    expect(res.status).toBe(400);
    expect(corpo.error).toContain("ao menos um achado");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejeita achados sem título e sem descrição com 400", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(
      requisicao({ achados: [{ titulo: "  ", descricao: "" }] }),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("título ou descrição");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejeita corpo não-JSON com 400 em vez de estourar", async () => {
    const res = await POST(
      new Request("http://localhost/api/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "isto não é json",
      }) as unknown as NextRequest,
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBeTruthy();
  });

  it("substitui severidade desconhecida por Média", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respostaIA(JSON.stringify(RELATORIO_IA))));

    const res = await POST(
      requisicao({ achados: [{ titulo: "A", severidade: "apocalíptico" }] }),
    );

    expect(res.status).toBe(200);
  });
});

/* ------------------------------------------------------------------ *
 * Caminho feliz                                                        *
 * ------------------------------------------------------------------ */

describe("POST /api/gerar — caminho da IA", () => {
  it("devolve o relatório normalizado quando a IA responde bem", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(respostaIA(JSON.stringify(RELATORIO_IA))),
    );

    const res = await POST(requisicao(ENTRADA));
    const corpo: Relatorio = await res.json();

    expect(res.status).toBe(200);
    expect(contratoCompleto(corpo)).toBe(true);
    expect(ehFallback(corpo)).toBe(false);
    expect(corpo.capa.cliente).toBe("Acme Corp");
    expect(corpo.achados).toHaveLength(1);
    expect(corpo.achados[0].cvss.score).toBe(9.8);
  });

  it("envia max_tokens suficiente e temperature baixa", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(respostaIA(JSON.stringify(RELATORIO_IA)));
    vi.stubGlobal("fetch", fetchSpy);

    await POST(requisicao(ENTRADA));

    const [, init] = fetchSpy.mock.calls[0];
    const corpo = JSON.parse(init.body as string);
    expect(corpo.max_tokens).toBeGreaterThanOrEqual(8000);
    expect(corpo.temperature).toBeLessThanOrEqual(0.5);
  });

  it("recupera JSON embrulhado em cercas de markdown", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respostaIA("```json\n" + JSON.stringify(RELATORIO_IA) + "\n```"),
      ),
    );

    const corpo: Relatorio = await (await POST(requisicao(ENTRADA))).json();

    expect(contratoCompleto(corpo)).toBe(true);
    expect(ehFallback(corpo)).toBe(false);
    expect(corpo.achados).toHaveLength(1);
  });

  it("respeita LAUDO_MODELO e LAUDO_MAX_TOKENS do ambiente", async () => {
    vi.stubEnv("LAUDO_MODELO", "meu-modelo");
    vi.stubEnv("LAUDO_MAX_TOKENS", "1234");
    const fetchSpy = vi.fn().mockResolvedValue(respostaIA(JSON.stringify(RELATORIO_IA)));
    vi.stubGlobal("fetch", fetchSpy);

    await POST(requisicao(ENTRADA));

    const corpo = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(corpo.model).toBe("meu-modelo");
    expect(corpo.max_tokens).toBe(1234);
  });
});

/* ------------------------------------------------------------------ *
 * Fallbacks — cada modo de falha precisa devolver relatório utilizável *
 * ------------------------------------------------------------------ */

describe("POST /api/gerar — fallback local", () => {
  it("monta o relatório sem chamar a IA quando OPENAI_API_KEY está ausente", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(requisicao(ENTRADA));
    const corpo: Relatorio = await res.json();

    expect(res.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(contratoCompleto(corpo)).toBe(true);
    expect(ehFallback(corpo)).toBe(true);
    expect(corpo.capa.cliente).toBe("Acme Corp");
    expect(corpo.achados).toHaveLength(1);
  });

  it("cai no fallback quando a resposta não tem choices", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ choices: [] }), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const corpo: Relatorio = await (await POST(requisicao(ENTRADA))).json();
    expect(ehFallback(corpo)).toBe(true);
    expect(contratoCompleto(corpo)).toBe(true);
  });

  it("cai no fallback quando message.content está ausente", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: {} }] }), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const corpo: Relatorio = await (await POST(requisicao(ENTRADA))).json();
    expect(ehFallback(corpo)).toBe(true);
  });

  it("cai no fallback quando o JSON da IA é inválido", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respostaIA("Desculpe, não posso.")));

    const corpo: Relatorio = await (await POST(requisicao(ENTRADA))).json();
    expect(ehFallback(corpo)).toBe(true);
    expect(contratoCompleto(corpo)).toBe(true);
  });

  it("cai no fallback quando o JSON da IA está truncado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(respostaIA(JSON.stringify(RELATORIO_IA).slice(0, 300))),
    );

    const corpo: Relatorio = await (await POST(requisicao(ENTRADA))).json();
    expect(ehFallback(corpo)).toBe(true);
    expect(corpo.achados).toHaveLength(1);
  });

  it("cai no fallback quando a IA devolve JSON sem nenhum achado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(respostaIA(JSON.stringify({ achados: [], capa: {} }))),
    );

    const corpo: Relatorio = await (await POST(requisicao(ENTRADA))).json();
    expect(ehFallback(corpo)).toBe(true);
  });

  it("cai no fallback quando a API responde com erro HTTP", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("rate limit", { status: 429 })),
    );

    const res = await POST(requisicao(ENTRADA));
    const corpo: Relatorio = await res.json();

    expect(res.status).toBe(200);
    expect(ehFallback(corpo)).toBe(true);
    // O motivo do fallback precisa ficar visível para o usuário saber por quê.
    expect(corpo.sumarioExecutivo.visaoGeral).toContain("429");
  });

  it("cai no fallback quando a conexão com a IA cai", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const res = await POST(requisicao(ENTRADA));
    const corpo: Relatorio = await res.json();

    expect(res.status).toBe(200);
    expect(ehFallback(corpo)).toBe(true);
    expect(contratoCompleto(corpo)).toBe(true);
  });

  it("cai no fallback quando o corpo da resposta não é JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>502</html>", { status: 200 })));

    const corpo: Relatorio = await (await POST(requisicao(ENTRADA))).json();
    expect(ehFallback(corpo)).toBe(true);
  });

  it("nunca devolve 5xx, mesmo com a IA fora do ar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("rede morta")));

    const res = await POST(requisicao(ENTRADA));
    expect(res.status).toBe(200);
  });
});

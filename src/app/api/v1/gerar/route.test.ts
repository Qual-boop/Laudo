import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Usuário real (a cota mensal grava em uso_mensal, que tem FK para usuarios).
const sessao = vi.hoisted(() => ({ id: 0, plano: "pro" as "free" | "pro" | "team" }));

vi.mock("@/lib/api-auth", () => ({
  exigirUsuario: vi.fn(
    async () =>
      ({
        ok: true,
        usuario: { id: sessao.id, nome: "QA", email: "qa.gerar@laudo-teste.com", plano: sessao.plano },
      }) as const,
  ),
  erroApi: (error: string, code: string, status: number) =>
    Response.json({ error, code }, { status }),
}));

import { POST } from "@/app/api/v1/gerar/route";
import db from "@/lib/db";
import { limparTudo } from "@/lib/limite-taxa";
import { criarUsuario } from "@/lib/usuarios";
import type { NextRequest } from "next/server";
import type { Relatorio } from "@/lib/tipos";

const EMAIL_QA = "qa.gerar@laudo-teste.com";

beforeAll(async () => {
  db.prepare("DELETE FROM usuarios WHERE email = ?").run(EMAIL_QA);
  sessao.id = (await criarUsuario("QA Gerar", EMAIL_QA, "senha-123456"))!.id;
});

afterAll(() => {
  db.prepare("DELETE FROM usuarios WHERE email = ?").run(EMAIL_QA);
});

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
  return new Request("http://localhost/api/v1/gerar", {
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
  // Cada teste começa com cota e rajada zeradas, no plano Pro.
  sessao.plano = "pro";
  limparTudo();
  db.prepare("DELETE FROM uso_mensal WHERE usuario_id = ?").run(sessao.id);
  silenciado = vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  // Host distinto do Groq de propósito: os testes da cadeia roteiam por host.
  vi.stubEnv("OPENAI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/");
  vi.stubEnv("OPENAI_API_KEY", "chave-de-teste");
  vi.stubEnv("LAUDO_MODELO", "meu-modelo");
  vi.stubEnv("LAUDO_MAX_TOKENS", "9999");
  // Groq desligado por padrão: os testes antigos exercitam só o provedor principal.
  // Os testes da cadeia ligam explicitamente com vi.stubEnv.
  vi.stubEnv("GROQ_API_KEY", "");
  vi.stubEnv("GROQ_BASE_URL", "");
  vi.stubEnv("GROQ_MODELO", "");
  vi.stubEnv("GROQ_MAX_TOKENS", "");
  // Backoff mínimo: os testes de retry não devem dormir de verdade.
  vi.stubEnv("LAUDO_RETRY_BASE_MS", "1");
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

describe("POST /api/v1/gerar — validação de entrada", () => {
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
      new Request("http://localhost/api/v1/gerar", {
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

describe("POST /api/v1/gerar — caminho da IA", () => {
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

describe("POST /api/v1/gerar — fallback local", () => {
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
    // Novo Response por chamada: o corpo de um Response só pode ser lido uma vez,
    // e a rota agora repete a requisição em status transitórios.
    const fetchSpy = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response("rate limit", { status: 429 })),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(requisicao(ENTRADA));
    const corpo: Relatorio = await res.json();

    expect(res.status).toBe(200);
    expect(ehFallback(corpo)).toBe(true);
    // O motivo do fallback precisa ficar visível para o usuário saber por quê.
    expect(corpo.sumarioExecutivo.visaoGeral).toContain("429");
    // 4 tentativas antes de desistir.
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it("não repete em erro permanente (modelo inexistente, 404)", async () => {
    const fetchSpy = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response("model not found", { status: 404 })),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const corpo: Relatorio = await (await POST(requisicao(ENTRADA))).json();

    expect(ehFallback(corpo)).toBe(true);
    expect(corpo.sumarioExecutivo.visaoGeral).toContain("404");
    // 404 não melhora com repetição — desiste na primeira.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("recupera quando uma tentativa transitoria falha e a seguinte funciona", async () => {
    const fetchSpy = vi
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve(new Response("high demand", { status: 503 })),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(RELATORIO_IA) } }] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      );
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(requisicao(ENTRADA));
    const corpo: Relatorio = await res.json();

    expect(res.status).toBe(200);
    expect(ehFallback(corpo)).toBe(false);
    expect(corpo.achados).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
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

/* ------------------------------------------------------------------ *
 * Cadeia de provedores: Gemini → Groq → relatório local               *
 * ------------------------------------------------------------------ */

const RESPOSTA_OK = (payload: unknown) =>
  new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );

const RESPOSTA_OK_TEXTO = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const erro503 = () => new Response("high demand", { status: 503 });

describe("cadeiaProvedores", () => {
  it("monta Gemini e Groq, nessa ordem, quando ambas as chaves existem", async () => {
    const { cadeiaProvedores } = await import("@/lib/ia");
    vi.stubEnv("GROQ_API_KEY", "gsk_teste");

    const cadeia = cadeiaProvedores();
    expect(cadeia.map((p) => p.nome)).toEqual(["Gemini", "Groq"]);
    expect(cadeia[0].url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    );
    expect(cadeia[1].url).toBe("https://api.groq.com/openai/v1/chat/completions");
  });

  it("normaliza barra final da base para não duplicar na URL", async () => {
    const { cadeiaProvedores } = await import("@/lib/ia");
    vi.stubEnv("GROQ_API_KEY", "gsk_teste");
    vi.stubEnv("GROQ_BASE_URL", "https://api.groq.com/openai/v1///");

    const groq = cadeiaProvedores().find((p) => p.nome === "Groq");
    expect(groq?.url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(groq?.url).not.toContain("//chat");
  });

  it("usa o modelo e max_tokens de cada provedor", async () => {
    const { cadeiaProvedores } = await import("@/lib/ia");
    vi.stubEnv("GROQ_API_KEY", "gsk_teste");
    vi.stubEnv("GROQ_MODELO", "meu-groq");
    vi.stubEnv("GROQ_MAX_TOKENS", "1234");

    const [gemini, groq] = cadeiaProvedores();
    expect(gemini.modelo).toBe("meu-modelo");
    expect(gemini.maxTokens).toBe(9999);
    expect(groq.modelo).toBe("meu-groq");
    expect(groq.maxTokens).toBe(1234);
  });

  it("omite o provedor sem chave configurada", async () => {
    const { cadeiaProvedores } = await import("@/lib/ia");

    vi.stubEnv("OPENAI_API_KEY", "");
    expect(cadeiaProvedores().map((p) => p.nome)).toEqual([]);

    vi.stubEnv("GROQ_API_KEY", "gsk_teste");
    expect(cadeiaProvedores().map((p) => p.nome)).toEqual(["Groq"]);

    vi.stubEnv("OPENAI_API_KEY", "chave-de-teste");
    expect(cadeiaProvedores().map((p) => p.nome)).toEqual(["Gemini", "Groq"]);
  });

  it("ignora chave em branco (só espaços)", async () => {
    const { cadeiaProvedores } = await import("@/lib/ia");
    vi.stubEnv("OPENAI_API_KEY", "   ");
    vi.stubEnv("GROQ_API_KEY", "");
    expect(cadeiaProvedores()).toEqual([]);
  });
});

describe("POST /api/v1/gerar — fallback Gemini → Groq", () => {
  it("Groq assume quando o Gemini esgota as 4 tentativas com 503", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_teste");

    const fetchSpy = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        url.includes("groq.com") ? RESPOSTA_OK(RELATORIO_IA) : erro503(),
      ),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(requisicao(ENTRADA));
    const corpo: Relatorio = await res.json();

    expect(res.status).toBe(200);
    expect(ehFallback(corpo)).toBe(false);
    expect(corpo.capa.cliente).toBe("Acme Corp");
    expect(corpo.achados).toHaveLength(1);

    // 4 tentativas no Gemini, 1 no Groq.
    expect(fetchSpy).toHaveBeenCalledTimes(5);
    const urls = fetchSpy.mock.calls.map((c) => c[0] as string);
    expect(urls.filter((u) => u.includes("generativelanguage")).length).toBe(4);
    expect(urls.filter((u) => u.includes("groq.com")).length).toBe(1);
  });

  it("envia o modelo, max_tokens e a chave de cada provedor corretamente", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_segredo");
    vi.stubEnv("GROQ_MODELO", "llama-3.3-70b");
    vi.stubEnv("GROQ_MAX_TOKENS", "777");

    const fetchSpy = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        url.includes("groq.com") ? RESPOSTA_OK(RELATORIO_IA) : erro503(),
      ),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await POST(requisicao(ENTRADA));

    const chamadaGroq = fetchSpy.mock.calls.at(-1)!;
    const corpo = JSON.parse(chamadaGroq[1].body as string);
    const headers = chamadaGroq[1].headers as Record<string, string>;

    expect(corpo.model).toBe("llama-3.3-70b");
    expect(corpo.max_tokens).toBe(777);
    expect(headers.Authorization).toBe("Bearer gsk_segredo");

    const chamadaGemini = fetchSpy.mock.calls[0];
    const headersGemini = chamadaGemini[1].headers as Record<string, string>;
    expect(headersGemini.Authorization).toBe("Bearer chave-de-teste");
  });

  it("não chama o Groq quando o Gemini funciona de primeira", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_teste");
    const fetchSpy = vi.fn().mockResolvedValue(RESPOSTA_OK(RELATORIO_IA));
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(requisicao(ENTRADA));
    const corpo: Relatorio = await res.json();

    expect(ehFallback(corpo)).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0] as string).toContain("generativelanguage");
  });

  it("vai direto ao Groq quando só ele tem chave", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "gsk_teste");

    const fetchSpy = vi.fn().mockResolvedValue(RESPOSTA_OK(RELATORIO_IA));
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(requisicao(ENTRADA));
    const corpo: Relatorio = await res.json();

    expect(res.status).toBe(200);
    expect(ehFallback(corpo)).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0] as string).toContain("groq.com");
  });

  it("usa o Groq quando o Gemini devolve JSON inválido (não só em erro HTTP)", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_teste");

    const fetchSpy = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        url.includes("groq.com")
          ? RESPOSTA_OK(RELATORIO_IA)
          : RESPOSTA_OK_TEXTO("Desculpe, não posso gerar isso."),
      ),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(requisicao(ENTRADA));
    const corpo: Relatorio = await res.json();

    expect(res.status).toBe(200);
    expect(ehFallback(corpo)).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("usa o Groq quando o Gemini devolve relatório sem achados", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_teste");

    const fetchSpy = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        url.includes("groq.com")
          ? RESPOSTA_OK(RELATORIO_IA)
          : RESPOSTA_OK({ capa: {}, achados: [] }),
      ),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const corpo: Relatorio = await (await POST(requisicao(ENTRADA))).json();
    expect(ehFallback(corpo)).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("relatório final cita os dois provedores e o motivo de cada falha", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_teste");

    const fetchSpy = vi
      .fn()
      .mockImplementation(() => Promise.resolve(erro503()));
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(requisicao(ENTRADA));
    const corpo: Relatorio = await res.json();
    const visao = corpo.sumarioExecutivo.visaoGeral;

    expect(res.status).toBe(200);
    expect(ehFallback(corpo)).toBe(true);
    expect(visao).toContain("Gemini");
    expect(visao).toContain("Groq");
    expect(visao).toContain("503");
    // 4 tentativas em cada um dos dois provedores.
    expect(fetchSpy).toHaveBeenCalledTimes(8);
  });

  it("relatório final é completo mesmo com a cadeia inteira fora", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_teste");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("sem rede")));

    const corpo: Relatorio = await (await POST(requisicao(ENTRADA))).json();

    expect(contratoCompleto(corpo)).toBe(true);
    expect(ehFallback(corpo)).toBe(true);
    expect(corpo.achados).toHaveLength(1);
    expect(corpo.sumarioExecutivo.visaoGeral).toContain("falha de comunicação");
  });

  it("não toca na rede quando nenhuma chave está configurada", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(requisicao(ENTRADA));
    const corpo: Relatorio = await res.json();

    expect(res.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(ehFallback(corpo)).toBe(true);
    expect(corpo.sumarioExecutivo.visaoGeral).toContain("nenhuma chave de IA");
  });
});

/* ------------------------------------------------------------------ *
 * Cota mensal e rajada                                                 *
 * ------------------------------------------------------------------ */

describe("POST /api/v1/gerar — cota de gerações e rajada", () => {
  function semIA() {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubGlobal("fetch", vi.fn());
  }

  it("cada geração consome 1 da cota de gerações com IA", async () => {
    semIA();
    await POST(requisicao(ENTRADA));
    await POST(requisicao(ENTRADA));
    const linha = db
      .prepare("SELECT geracoes_ia FROM uso_mensal WHERE usuario_id = ?")
      .get(sessao.id) as { geracoes_ia: number };
    expect(linha.geracoes_ia).toBe(2);
  });

  it("free: a 7ª geração do mês recebe 402 com recurso 'geracoes'", async () => {
    semIA();
    sessao.plano = "free";
    for (let i = 0; i < 6; i++) {
      expect((await POST(requisicao(ENTRADA))).status).toBe(200);
    }
    const res = await POST(requisicao(ENTRADA));
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({
      code: "LIMITE_PLANO",
      recurso: "geracoes",
      usados: 6,
      limite: 6,
      plano: "free",
    });
  });

  it("cota de relatórios esgotada bloqueia antes de gastar IA", async () => {
    semIA();
    sessao.plano = "free";
    db.prepare(
      "INSERT INTO uso_mensal (usuario_id, mes_ano, relatorios_criados) VALUES (?, ?, 3)",
    ).run(sessao.id, (await import("@/lib/limites")).mesAtual());
    const res = await POST(requisicao(ENTRADA));
    expect(res.status).toBe(402);
    expect((await res.json()).recurso).toBe("relatorios");
  });

  it("rajada: a 21ª chamada em 10 minutos recebe 429 com Retry-After", async () => {
    semIA();
    for (let i = 0; i < 20; i++) await POST(requisicao(ENTRADA));
    const res = await POST(requisicao(ENTRADA));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});
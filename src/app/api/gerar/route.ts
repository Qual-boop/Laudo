import type { NextRequest } from "next/server";
import {
  montarPrompt,
  normalizarRelatorio,
  relatorioFallback,
} from "@/lib/relatorio";
import type { RelatorioEntrada } from "@/lib/tipos";

const MODELO_PADRAO = "gemini-3.8-flash";
const MAX_TOKENS_PADRAO = 16000;

/**
 * O Gemini devolve 503 "high demand" com frequência mesmo no plano gratuito.
 * Sem retentativa, a maioria das gerações cairia no fallback local.
 * Só repetimos em erros transitórios — 400 (modelo inválido) não melhora.
 */
const STATUS_TRANSIENTOS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const MAX_TENTATIVAS = 4;

async function chamarComRetry(
  url: string,
  corpo: string,
  chave: string,
): Promise<Response> {
  // Lido na chamada, não no carregamento do módulo, para respeitar override em teste.
  const esperaBase = Number(process.env.LAUDO_RETRY_BASE_MS) || 2000;
  let ultimo: Response | null = null;

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa += 1) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${chave}`,
      },
      body: corpo,
      signal: AbortSignal.timeout(180_000),
    });

    if (res.ok || !STATUS_TRANSIENTOS.has(res.status)) {
      return res;
    }

    ultimo = res;
    // clone() para loggar sem consumir o corpo: o chamador ainda precisa lê-lo
    // caso as tentativas se esgotem.
    const detalhe = (await res.clone().text()).slice(0, 300);
    console.error(
      `[IA] ${res.status} na tentativa ${tentativa}/${MAX_TENTATIVAS}:`,
      detalhe,
    );

    if (tentativa < MAX_TENTATIVAS) {
      // Backoff exponencial com jitter: 2s, 4s, 8s (+ até 1s aleatório).
      const espera = esperaBase * 2 ** (tentativa - 1) + Math.random() * 1000;
      await new Promise((r) => setTimeout(r, espera));
    }
  }

  return ultimo as Response;
}

function validarEntrada(bruto: unknown): RelatorioEntrada {
  const e = (bruto ?? {}) as Partial<RelatorioEntrada>;
  const achados = Array.isArray(e.achados) ? e.achados : [];

  if (achados.length === 0) {
    throw new Error("Informe ao menos um achado para gerar o relatório.");
  }

  const entrada: RelatorioEntrada = {
    cliente: typeof e.cliente === "string" ? e.cliente : "",
    titulo: typeof e.titulo === "string" ? e.titulo : "",
    escopo: typeof e.escopo === "string" ? e.escopo : "",
    periodo: typeof e.periodo === "string" ? e.periodo : "",
    limitacoes: typeof e.limitacoes === "string" ? e.limitacoes : "",
    ferramentas: typeof e.ferramentas === "string" ? e.ferramentas : "",
    achados: achados.map((a) => {
      const x = (a ?? {}) as Record<string, unknown>;
      const sev = String(x.severidade ?? "Media");
      return {
        titulo: typeof x.titulo === "string" ? x.titulo : "",
        severidade: (["Critica", "Alta", "Media", "Baixa"] as const).includes(
          sev as never,
        )
          ? (sev as RelatorioEntrada["achados"][number]["severidade"])
          : "Media",
        cwe: typeof x.cwe === "string" ? x.cwe : "",
        descricao: typeof x.descricao === "string" ? x.descricao : "",
        evidencia: typeof x.evidencia === "string" ? x.evidencia : "",
      };
    }),
  };

  const semDescricao = entrada.achados.every(
    (a) => !a.titulo.trim() && !a.descricao.trim(),
  );
  if (semDescricao) {
    throw new Error("Cada achado precisa de ao menos um título ou descrição.");
  }

  return entrada;
}

export async function POST(request: NextRequest) {
  let entrada: RelatorioEntrada;

  try {
    entrada = validarEntrada(await request.json());
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Entrada inválida.";
    return Response.json({ error: mensagem }, { status: 400 });
  }

  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  // A base do Gemini já termina em "/" — sem normalizar viraria "openai//chat/completions".
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const modelo = process.env.LAUDO_MODELO || MODELO_PADRAO;
  const maxTokens = Number(process.env.LAUDO_MAX_TOKENS) || MAX_TOKENS_PADRAO;

  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      relatorioFallback(entrada, "OPENAI_API_KEY não configurada."),
    );
  }

  console.log("[IA] URL:", url, "| modelo:", modelo, "| max_tokens:", maxTokens);

  const corpo = JSON.stringify({
    model: modelo,
    messages: [{ role: "user", content: montarPrompt(entrada) }],
    response_format: { type: "json_object" },
    max_tokens: maxTokens,
    temperature: 0.3,
  });

  let res: Response;
  try {
    res = await chamarComRetry(url, corpo, process.env.OPENAI_API_KEY);
  } catch (e) {
    console.error("[IA] Falha ao chamar a API:", e);
    return Response.json(
      relatorioFallback(entrada, "Falha de comunicação com a IA."),
    );
  }

  console.log("[IA] Status HTTP:", res.status);

  if (!res.ok) {
    const corpoErro = await res.text();
    console.error("[IA] Erro na API:", res.status, corpoErro.slice(0, 500));
    return Response.json(relatorioFallback(entrada, `A IA respondeu ${res.status}.`));
  }

  try {
    const data = await res.json();
    const conteudo = data?.choices?.[0]?.message?.content;

    if (typeof conteudo !== "string" || !conteudo.trim()) {
      console.error("[IA] Resposta vazia:", JSON.stringify(data).slice(0, 500));
      return Response.json(relatorioFallback(entrada, "Resposta vazia da IA."));
    }

    let bruto: unknown;
    try {
      bruto = JSON.parse(conteudo);
    } catch {
      // Modelos às vezes embrulham o JSON em ```json ... ```
      const casaco = conteudo.match(/\{[\s\S]*\}/);
      if (!casaco) {
        console.error("[IA] JSON inválido e sem objeto recuperável.");
        return Response.json(
          relatorioFallback(entrada, "A IA devolveu texto que não é JSON."),
        );
      }
      try {
        bruto = JSON.parse(casaco[0]);
      } catch {
        console.error("[IA] JSON irrecuperável.");
        return Response.json(
          relatorioFallback(entrada, "A IA devolveu JSON inválido."),
        );
      }
    }

    const relatorio = normalizarRelatorio(bruto, entrada);

    if (relatorio.achados.length === 0) {
      console.error("[IA] Relatório normalizado sem achados.");
      return Response.json(
        relatorioFallback(entrada, "A IA não devolveu nenhum achado."),
      );
    }

    return Response.json(relatorio);
  } catch (e) {
    console.error("[IA] Falha ao processar a resposta:", e);
    return Response.json(
      relatorioFallback(entrada, "Resposta da IA não pôde ser processada."),
    );
  }
}

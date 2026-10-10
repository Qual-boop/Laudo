import type { NextRequest } from "next/server";
import {
  montarPrompt,
  normalizarRelatorio,
  relatorioFallback,
} from "@/lib/relatorio";
import { normalizarConfianca } from "@/lib/verificacao";
import type { Relatorio, RelatorioEntrada } from "@/lib/tipos";

/* ============================================================
   Cadeia de provedores
   O Gemini responde 503 "high demand" com frequência na cota
   gratuita. Em vez de cair direto no relatório local, tentamos
   o próximo provedor da cadeia.
   ============================================================ */

type Provedor = {
  nome: string;
  url: string;
  modelo: string;
  maxTokens: number;
  chave: string;
};

/** Nível 1 — Gemini (principal). */
const MODELO_PADRAO = "gemini-3.8-flash";
const MAX_TOKENS_PADRAO = 16000;
const BASE_PADRAO = "https://api.openai.com/v1";

/** Nível 2 — Groq (secundário). */
const GROQ_URL_PADRAO = "https://api.groq.com/openai/v1";
const GROQ_MODELO_PADRAO = "openai/gpt-oss-120b";
const GROQ_MAX_TOKENS_PADRAO = 6000;

/** Nível 3 — relatório local (relatorioFallback), sem rede. */

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

/** A base do Gemini já termina em "/" — sem normalizar viraria "openai//chat/completions". */
function montarUrl(base: string): string {
  return `${base.replace(/\/+$/, "")}/chat/completions`;
}

function numeroEnv(v: string | undefined, padrao: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : padrao;
}

/** Monta a cadeia na ordem de preferência. Provedor sem chave é simply ignorado. */
export function cadeiaProvedores(): Provedor[] {
  const lista: Provedor[] = [];

  const chaveGemini = process.env.OPENAI_API_KEY?.trim();
  if (chaveGemini) {
    lista.push({
      nome: "Gemini",
      url: montarUrl(process.env.OPENAI_BASE_URL || BASE_PADRAO),
      modelo: process.env.LAUDO_MODELO || MODELO_PADRAO,
      maxTokens: numeroEnv(process.env.LAUDO_MAX_TOKENS, MAX_TOKENS_PADRAO),
      chave: chaveGemini,
    });
  }

  const chaveGroq = process.env.GROQ_API_KEY?.trim();
  if (chaveGroq) {
    lista.push({
      nome: "Groq",
      url: montarUrl(process.env.GROQ_BASE_URL || GROQ_URL_PADRAO),
      modelo: process.env.GROQ_MODELO || GROQ_MODELO_PADRAO,
      maxTokens: numeroEnv(process.env.GROQ_MAX_TOKENS, GROQ_MAX_TOKENS_PADRAO),
      chave: chaveGroq,
    });
  }

  return lista;
}

type ResultadoProvedor =
  | { relatorio: Relatorio }
  | { erro: string };

/**
 * Executa um provedor do início ao fim. Devolve o relatório normalizado ou o
 * motivo da falha — nunca lança, porque o chamador precisa poder seguir para o
 * próximo provedor da cadeia.
 */
async function tentarProvedor(
  provedor: Provedor,
  entrada: RelatorioEntrada,
): Promise<ResultadoProvedor> {
  console.log(
    `[IA] ${provedor.nome}: ${provedor.url} | modelo: ${provedor.modelo} | max_tokens: ${provedor.maxTokens}`,
  );

  const corpo = JSON.stringify({
    model: provedor.modelo,
    messages: [{ role: "user", content: montarPrompt(entrada) }],
    response_format: { type: "json_object" },
    max_tokens: provedor.maxTokens,
    temperature: 0.3,
  });

  let res: Response;
  try {
    res = await chamarComRetry(provedor.url, corpo, provedor.chave);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[IA] ${provedor.nome}: falha de comunicação:`, msg);
    return { erro: `falha de comunicação (${msg})` };
  }

  console.log(`[IA] ${provedor.nome}: status HTTP ${res.status}`);

  if (!res.ok) {
    const corpoErro = await res.text();
    console.error(
      `[IA] ${provedor.nome}: erro ${res.status}:`,
      corpoErro.slice(0, 500),
    );
    return { erro: `respondeu HTTP ${res.status}` };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    console.error(`[IA] ${provedor.nome}: corpo da resposta não é JSON.`);
    return { erro: "corpo da resposta não é JSON" };
  }

  const conteudo = (data as { choices?: { message?: { content?: unknown } }[] })
    ?.choices?.[0]?.message?.content;

  if (typeof conteudo !== "string" || !conteudo.trim()) {
    console.error(`[IA] ${provedor.nome}: resposta vazia.`);
    return { erro: "resposta vazia" };
  }

  let bruto: unknown;
  try {
    bruto = JSON.parse(conteudo);
  } catch {
    // Modelos às vezes embrulham o JSON em ```json ... ```
    const casaco = conteudo.match(/\{[\s\S]*\}/);
    if (!casaco) {
      console.error(`[IA] ${provedor.nome}: texto que não é JSON.`);
      return { erro: "devolveu texto que não é JSON" };
    }
    try {
      bruto = JSON.parse(casaco[0]);
    } catch {
      console.error(`[IA] ${provedor.nome}: JSON irrecuperável.`);
      return { erro: "devolveu JSON inválido" };
    }
  }

  const relatorio = normalizarRelatorio(bruto, entrada);

  if (relatorio.achados.length === 0) {
    console.error(`[IA] ${provedor.nome}: relatório normalizado sem achados.`);
    return { erro: "não devolveu nenhum achado" };
  }

  return { relatorio };
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
        confianca: normalizarConfianca(x.confianca),
        dataRetesteSugerida:
          typeof x.dataRetesteSugerida === "string" ? x.dataRetesteSugerida : "",
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

  const provedores = cadeiaProvedores();

  if (provedores.length === 0) {
    return Response.json(
      relatorioFallback(
        entrada,
        "nenhuma chave de IA configurada (OPENAI_API_KEY ou GROQ_API_KEY).",
      ),
    );
  }

  const falhas: string[] = [];

  for (const provedor of provedores) {
    const resultado = await tentarProvedor(provedor, entrada);

    if ("relatorio" in resultado) {
      if (falhas.length > 0) {
        console.log(
          `[IA] ${provedor.nome} assumiu após falha de: ${falhas.join(" · ")}`,
        );
      }
      return Response.json(resultado.relatorio);
    }

    falhas.push(`${provedor.nome}: ${resultado.erro}`);
    console.error(
      `[IA] ${provedor.nome} falhou (${resultado.erro}) — indo para o próximo provedor.`,
    );
  }

  const motivo = `todos os provedores falharam — ${falhas.join(" · ")}`;
  console.error(`[IA] ${motivo}. Usando relatório local.`);
  return Response.json(relatorioFallback(entrada, motivo));
}

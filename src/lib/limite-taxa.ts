/**
 * Rate limit das rotas de autenticação (login web, token mobile, cadastro).
 *
 * Janela fixa por chave, em memória do processo. Serve para uma instância
 * só (o deploy atual no Railway); com réplicas, cada uma conta à parte e o
 * limite efetivo multiplica — aí o contador precisa ir para o banco/Redis.
 * Reiniciar o processo zera os contadores.
 *
 * Duas chaves por tentativa: o IP (força bruta de um lugar só) e o e-mail
 * (credential stuffing distribuído contra uma conta). Login certo libera o
 * contador do e-mail; o do IP continua contando.
 */

export type Regra = { limite: number; janelaMs: number };

export const REGRAS = {
  loginIp: { limite: 30, janelaMs: 15 * 60_000 },
  loginEmail: { limite: 10, janelaMs: 15 * 60_000 },
  cadastroIp: { limite: 20, janelaMs: 60 * 60_000 },
  cadastroEmail: { limite: 5, janelaMs: 60 * 60_000 },
} satisfies Record<string, Regra>;

/** Bloqueio ativo: segundos até a janela que estourou acabar. */
export type Bloqueio = { retryAfterSeg: number };

type Janela = { inicio: number; contagem: number; janelaMs: number };

/** Teto de chaves: um spray de e-mails/IPs não pode crescer o Map sem fim. */
export const MAX_CHAVES = 50_000;

// No globalThis: as rotas e o `authorize` do NextAuth podem cair em chunks
// diferentes do bundle, e o contador precisa ser um só no processo.
const g = globalThis as typeof globalThis & { __laudoLimiteTaxa?: Map<string, Janela> };
const janelas: Map<string, Janela> = (g.__laudoLimiteTaxa ??= new Map());

/**
 * Conta uma tentativa em `chave`. Devolve o bloqueio se a janela já está
 * cheia (a tentativa bloqueada não conta, então não estende a punição).
 */
export function consumir(chave: string, regra: Regra, agora = Date.now()): Bloqueio | null {
  let j = janelas.get(chave);
  if (j && agora - j.inicio >= j.janelaMs) j = undefined;

  if (j && j.contagem >= regra.limite) {
    return { retryAfterSeg: Math.max(1, Math.ceil((j.inicio + j.janelaMs - agora) / 1000)) };
  }

  if (!j) {
    j = { inicio: agora, contagem: 0, janelaMs: regra.janelaMs };
    // Cheio: descarta a chave tocada há mais tempo (o Map mantém a ordem de
    // inserção e toda tentativa reinsere a chave no fim). O IP e o e-mail
    // sob ataque são tocados a cada tentativa, então nunca são os mais
    // antigos. O(1) — varrer o Map inteiro aqui viraria custo por request.
    if (janelas.size >= MAX_CHAVES) {
      const maisAntiga = janelas.keys().next().value;
      if (maisAntiga !== undefined) janelas.delete(maisAntiga);
    }
  }
  j.contagem += 1;
  janelas.delete(chave);
  janelas.set(chave, j);
  return null;
}

/** Zera a contagem de uma chave (login certo libera o e-mail). */
export function liberar(chave: string): void {
  janelas.delete(chave);
}

/** Só para testes. */
export function limparTudo(): void {
  janelas.clear();
}

export function normalizarEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const e = email.trim().toLowerCase().slice(0, 254);
  return e || null;
}

/**
 * IP do cliente a partir do X-Forwarded-For.
 *
 * Usa a entrada MAIS À DIREITA (descontados os proxies confiáveis): é a
 * que o proxy do Railway escreveu. As da esquerda vêm do cliente e são
 * forjáveis — ler a primeira deixaria trocar de "IP" a cada tentativa.
 * Sem proxy na frente (`next start` local), o próprio Next preenche o
 * cabeçalho com o IP do socket. `PROXIES_CONFIAVEIS` (padrão 1) é o número
 * de proxies que acrescentam entrada antes do app.
 */
export function ipDoCliente(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (!xff) return null;
  const partes = xff
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (partes.length === 0) return null;
  const n = Number.parseInt(process.env.PROXIES_CONFIAVEIS ?? "", 10);
  const saltos = Number.isFinite(n) && n >= 1 ? n : 1;
  return partes[Math.max(0, partes.length - saltos)].slice(0, 64);
}

/** O bloqueio mais longo entre os que estouraram, ou null. */
function pior(...bloqueios: (Bloqueio | null)[]): Bloqueio | null {
  let r: Bloqueio | null = null;
  for (const b of bloqueios) {
    if (b && (!r || b.retryAfterSeg > r.retryAfterSeg)) r = b;
  }
  return r;
}

/**
 * Login web e token mobile dividem o contador: são o mesmo alvo (a senha).
 * Sem IP conhecido, só o e-mail limita — nunca um balde global, que viraria
 * um DoS de login para todo mundo.
 */
export function verificarLogin(ip: string | null, email: unknown): Bloqueio | null {
  const e = normalizarEmail(email);
  return pior(
    ip ? consumir(`login:ip:${ip}`, REGRAS.loginIp) : null,
    e ? consumir(`login:email:${e}`, REGRAS.loginEmail) : null,
  );
}

export function liberarEmailLogin(email: unknown): void {
  const e = normalizarEmail(email);
  if (e) liberar(`login:email:${e}`);
}

export function verificarCadastro(ip: string | null, email: unknown): Bloqueio | null {
  const e = normalizarEmail(email);
  return pior(
    ip ? consumir(`cadastro:ip:${ip}`, REGRAS.cadastroIp) : null,
    e ? consumir(`cadastro:email:${e}`, REGRAS.cadastroEmail) : null,
  );
}

export const MENSAGEM_429 = "Muitas tentativas. Aguarde alguns minutos e tente de novo.";

/** 429 no formato de `erroApi`, com Retry-After em segundos. */
export function resposta429(b: Bloqueio, corpoExtra: Record<string, unknown> = {}): Response {
  return Response.json(
    { error: MENSAGEM_429, code: "MUITAS_TENTATIVAS", ...corpoExtra },
    { status: 429, headers: { "Retry-After": String(b.retryAfterSeg) } },
  );
}

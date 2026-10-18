import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_CHAVES,
  REGRAS,
  consumir,
  ipDoCliente,
  liberarEmailLogin,
  limparTudo,
  resposta429,
  verificarCadastro,
  verificarLogin,
} from "@/lib/limite-taxa";

const REGRA = { limite: 3, janelaMs: 60_000 };

beforeEach(() => limparTudo());
afterEach(() => {
  limparTudo();
  vi.unstubAllEnvs();
});

describe("consumir", () => {
  it("deixa passar até o limite e bloqueia a próxima", () => {
    const t = 1_000_000;
    expect(consumir("k", REGRA, t)).toBeNull();
    expect(consumir("k", REGRA, t + 1)).toBeNull();
    expect(consumir("k", REGRA, t + 2)).toBeNull();
    expect(consumir("k", REGRA, t + 10_000)).toEqual({ retryAfterSeg: 50 });
  });

  it("tentativa bloqueada não estende a janela", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) consumir("k", REGRA, t);
    for (let i = 0; i < 20; i++) consumir("k", REGRA, t + 30_000);
    expect(consumir("k", REGRA, t + 59_999)).toEqual({ retryAfterSeg: 1 });
    expect(consumir("k", REGRA, t + 60_000)).toBeNull();
  });

  it("chaves são independentes", () => {
    for (let i = 0; i < 3; i++) consumir("a", REGRA);
    expect(consumir("a", REGRA)).not.toBeNull();
    expect(consumir("b", REGRA)).toBeNull();
  });

  it("não passa do teto de chaves (spray de e-mails)", () => {
    const t = 1_000_000;
    for (let i = 0; i < MAX_CHAVES + 100; i++) consumir(`spray:${i}`, REGRA, t);
    // A chave mais nova ainda conta; a mais antiga foi descartada.
    for (let i = 0; i < 2; i++) consumir(`spray:${MAX_CHAVES + 99}`, REGRA, t);
    expect(consumir(`spray:${MAX_CHAVES + 99}`, REGRA, t)).not.toBeNull();
  });
});

describe("ipDoCliente", () => {
  const h = (xff?: string) => new Headers(xff ? { "x-forwarded-for": xff } : {});

  it("usa a entrada mais à direita (a do proxy), não a forjável da esquerda", () => {
    expect(ipDoCliente(h("6.6.6.6, 203.0.113.7"))).toBe("203.0.113.7");
    expect(ipDoCliente(h("203.0.113.7"))).toBe("203.0.113.7");
  });

  it("respeita PROXIES_CONFIAVEIS", () => {
    vi.stubEnv("PROXIES_CONFIAVEIS", "2");
    expect(ipDoCliente(h("6.6.6.6, 203.0.113.7, 10.0.0.2"))).toBe("203.0.113.7");
    vi.stubEnv("PROXIES_CONFIAVEIS", "9");
    expect(ipDoCliente(h("203.0.113.7, 10.0.0.2"))).toBe("203.0.113.7");
  });

  it("sem cabeçalho devolve null", () => {
    expect(ipDoCliente(h())).toBeNull();
    expect(ipDoCliente(h(" , "))).toBeNull();
  });
});

describe("verificarLogin", () => {
  it("bloqueia por e-mail mesmo trocando de IP (e normaliza o e-mail)", () => {
    for (let i = 0; i < REGRAS.loginEmail.limite; i++) {
      expect(verificarLogin(`198.51.100.${i}`, "Alvo@Laudo.teste")).toBeNull();
    }
    expect(verificarLogin("198.51.100.250", " alvo@laudo.teste ")).not.toBeNull();
  });

  it("bloqueia por IP mesmo trocando de e-mail", () => {
    for (let i = 0; i < REGRAS.loginIp.limite; i++) {
      expect(verificarLogin("198.51.100.9", `u${i}@laudo.teste`)).toBeNull();
    }
    expect(verificarLogin("198.51.100.9", "outro@laudo.teste")).not.toBeNull();
    expect(verificarLogin("198.51.100.10", "outro@laudo.teste")).toBeNull();
  });

  it("login certo libera o e-mail", () => {
    for (let i = 0; i < REGRAS.loginEmail.limite; i++) verificarLogin(null, "a@laudo.teste");
    expect(verificarLogin(null, "a@laudo.teste")).not.toBeNull();
    liberarEmailLogin("A@laudo.teste");
    expect(verificarLogin(null, "a@laudo.teste")).toBeNull();
  });

  it("sem IP e sem e-mail não limita (nunca um balde global)", () => {
    for (let i = 0; i < 100; i++) expect(verificarLogin(null, undefined)).toBeNull();
  });
});

describe("verificarCadastro", () => {
  it("limita e-mail repetido e IP", () => {
    for (let i = 0; i < REGRAS.cadastroEmail.limite; i++) {
      expect(verificarCadastro(`192.0.2.${i}`, "dup@laudo.teste")).toBeNull();
    }
    expect(verificarCadastro("192.0.2.200", "dup@laudo.teste")).not.toBeNull();

    for (let i = 0; i < REGRAS.cadastroIp.limite; i++) {
      expect(verificarCadastro("192.0.2.77", `n${i}@laudo.teste`)).toBeNull();
    }
    expect(verificarCadastro("192.0.2.77", "novo@laudo.teste")).not.toBeNull();
  });
});

describe("resposta429", () => {
  it("responde 429 com Retry-After e corpo no formato da API", async () => {
    const r = resposta429({ retryAfterSeg: 42 });
    expect(r.status).toBe(429);
    expect(r.headers.get("Retry-After")).toBe("42");
    expect(await r.json()).toMatchObject({ code: "MUITAS_TENTATIVAS" });
  });
});

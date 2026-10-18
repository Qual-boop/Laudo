import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as postToken } from "@/app/api/v1/auth/token/route";
import { POST as postCadastro } from "@/app/api/v1/auth/cadastro/route";
import { POST as postNextAuth } from "@/app/api/auth/[...nextauth]/route";
import { REGRAS, consumir, limparTudo } from "@/lib/limite-taxa";

// O NextAuth de verdade não carrega no vitest (importa `next/server` sem
// extensão); aqui só importa o embrulho de rate limit em volta dele.
const { postReal } = vi.hoisted(() => ({
  postReal: vi.fn(async () => new Response("nextauth", { status: 200 })),
}));
vi.mock("@/auth", () => ({ handlers: { GET: vi.fn(), POST: postReal } }));

const SEGREDO = "segredo-de-teste-com-32-caracteres!!";

function json(url: string, corpo: unknown, ip: string): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
    body: JSON.stringify(corpo),
  });
}

beforeEach(() => {
  limparTudo();
  vi.stubEnv("AUTH_SECRET", SEGREDO);
});
afterEach(() => {
  limparTudo();
  vi.unstubAllEnvs();
});

describe("POST /api/v1/auth/token — rate limit", () => {
  it("401 até o limite do e-mail, depois 429 com Retry-After", async () => {
    const corpo = { email: "ninguem.rl@laudo.teste", senha: "senha-errada-123" };
    for (let i = 0; i < REGRAS.loginEmail.limite; i++) {
      const r = await postToken(json("http://localhost/api/v1/auth/token", corpo, `203.0.113.${i}`));
      expect(r.status).toBe(401);
    }
    const r = await postToken(json("http://localhost/api/v1/auth/token", corpo, "203.0.113.99"));
    expect(r.status).toBe(429);
    expect(Number(r.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await r.json()).toMatchObject({ code: "MUITAS_TENTATIVAS" });
  });

  it("X-Forwarded-For forjado à esquerda não reseta o limite de IP", async () => {
    for (let i = 0; i < REGRAS.loginIp.limite; i++) {
      consumir("login:ip:203.0.113.50", REGRAS.loginIp);
    }
    const r = await postToken(
      json(
        "http://localhost/api/v1/auth/token",
        { email: "qualquer.rl@laudo.teste", senha: "senha-errada-123" },
        "1.2.3.4, 203.0.113.50",
      ),
    );
    expect(r.status).toBe(429);
  });
});

describe("POST /api/v1/auth/cadastro — rate limit", () => {
  it("429 com Retry-After quando o IP estoura", async () => {
    for (let i = 0; i < REGRAS.cadastroIp.limite; i++) {
      consumir("cadastro:ip:203.0.113.60", REGRAS.cadastroIp);
    }
    const r = await postCadastro(
      json(
        "http://localhost/api/v1/auth/cadastro",
        { nome: "X", email: "novo.rl@laudo.teste", senha: "senha-123456" },
        "203.0.113.60",
      ),
    );
    expect(r.status).toBe(429);
    expect(r.headers.get("Retry-After")).toBeTruthy();
  });
});

describe("POST /api/auth/callback/credentials — rate limit", () => {
  function login(caminho: string, email: string, ip: string): NextRequest {
    return new NextRequest(`http://localhost${caminho}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Forwarded-For": ip,
      },
      body: new URLSearchParams({ email, senha: "x", csrfToken: "x" }),
    });
  }

  it("dentro do limite repassa ao NextAuth, com o corpo ainda legível", async () => {
    postReal.mockClear();
    const r = await postNextAuth(login("/api/auth/callback/credentials", "a.rl@laudo.teste", "203.0.113.71"));
    expect(r.status).toBe(200);
    expect(postReal).toHaveBeenCalledTimes(1);
    const repassado = (postReal.mock.calls[0] as unknown as [NextRequest])[0];
    expect((await repassado.formData()).get("email")).toBe("a.rl@laudo.teste");
  });

  it("429 com url que o signIn() do cliente consegue ler", async () => {
    for (let i = 0; i < REGRAS.loginEmail.limite; i++) {
      consumir("login:email:alvo.rl@laudo.teste", REGRAS.loginEmail);
    }
    postReal.mockClear();
    const r = await postNextAuth(login("/api/auth/callback/credentials", "Alvo.RL@laudo.teste", "203.0.113.70"));
    expect(r.status).toBe(429);
    expect(r.headers.get("Retry-After")).toBeTruthy();
    const corpo = (await r.json()) as { url: string };
    expect(new URL(corpo.url).searchParams.get("error")).toBe("MuitasTentativas");
    expect(postReal).not.toHaveBeenCalled();
  });

  it("outras rotas POST do NextAuth não contam", async () => {
    for (let i = 0; i < REGRAS.loginIp.limite; i++) {
      consumir("login:ip:203.0.113.72", REGRAS.loginIp);
    }
    const r = await postNextAuth(login("/api/auth/signout", "x@laudo.teste", "203.0.113.72"));
    expect(r.status).toBe(200);
  });
});

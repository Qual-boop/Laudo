import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import db from "@/lib/db";
import { POST as iniciar } from "@/app/api/v1/auth/login/iniciar/route";
import { POST as confirmar } from "@/app/api/v1/auth/login/confirmar/route";
import { POST as solicitarSenha } from "@/app/api/v1/auth/senha/solicitar/route";
import { POST as redefinirSenha } from "@/app/api/v1/auth/senha/redefinir/route";
import { conferirCodigo, emitirCodigo, REENVIO_SEG } from "@/lib/codigos";
import { limparTudo } from "@/lib/limite-taxa";
import { criarSessao, sessaoValida } from "@/lib/sessoes";
import { compararSenha, criarUsuario } from "@/lib/usuarios";

const EMAIL = "qa.fluxo@laudo-teste.com";
const SENHA = "frase longa de teste 42";
let id = 0;
let enviados: { para: string; texto: string }[] = [];

function post(url: string, corpo: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
}

/** O código sai do texto do e-mail capturado (como o usuário leria). */
function ultimoCodigo(): string {
  const m = /\b(\d{6})\b/.exec(enviados.at(-1)?.texto ?? "");
  if (!m) throw new Error("nenhum código enviado");
  return m[1];
}

beforeAll(async () => {
  db.prepare("DELETE FROM usuarios WHERE email = ?").run(EMAIL);
  id = (await criarUsuario("QA Fluxo", EMAIL, SENHA))!.id;
});

afterAll(() => {
  db.prepare("DELETE FROM usuarios WHERE email = ?").run(EMAIL);
});

beforeEach(() => {
  limparTudo();
  enviados = [];
  db.prepare("DELETE FROM codigos_email WHERE usuario_id = ?").run(id);
  vi.stubEnv("AUTH_SECRET", "segredo-de-teste-com-32-caracteres!!");
  vi.stubEnv("BREVO_API_KEY", "chave-teste");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("EMAIL_REMETENTE", "nao-responda@provafix.test");
  vi.spyOn(console, "error").mockImplementation(() => {});
  // Captura o envio ao Brevo em vez de sair para a rede.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe("https://api.brevo.com/v3/smtp/email");
      const corpo = JSON.parse(String(init.body));
      enviados.push({ para: corpo.to[0].email, texto: corpo.textContent });
      return new Response("{}", { status: 201 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("login em duas etapas", () => {
  it("sem provedor de e-mail: iniciar responde etapa 'senha' e não envia nada", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const res = await iniciar(post("/api/v1/auth/login/iniciar", { email: EMAIL, senha: SENHA }));
    expect(await res.json()).toEqual({ etapa: "senha" });
    expect(enviados).toHaveLength(0);
  });

  it("senha errada: 401 genérico e nenhum código enviado", async () => {
    const res = await iniciar(post("/api/v1/auth/login/iniciar", { email: EMAIL, senha: "errada-123" }));
    expect(res.status).toBe(401);
    expect(enviados).toHaveLength(0);
  });

  it("senha certa: código de 6 dígitos vai para o e-mail, e-mail aparece mascarado", async () => {
    const res = await iniciar(post("/api/v1/auth/login/iniciar", { email: EMAIL, senha: SENHA }));
    expect(await res.json()).toMatchObject({ etapa: "codigo", email: "qa***@laudo-teste.com" });
    expect(enviados).toHaveLength(1);
    expect(enviados[0].para).toBe(EMAIL);
    expect(ultimoCodigo()).toMatch(/^\d{6}$/);
    // Só o HMAC fica no banco, nunca o código.
    const linha = db
      .prepare("SELECT codigo_hash FROM codigos_email WHERE usuario_id = ? AND finalidade = 'login'")
      .get(id) as { codigo_hash: string };
    expect(linha.codigo_hash).not.toContain(ultimoCodigo());
    expect(linha.codigo_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("código certo → ticket de uso único; o ticket só vale uma vez", async () => {
    await iniciar(post("/api/v1/auth/login/iniciar", { email: EMAIL, senha: SENHA }));
    const res = await confirmar(
      post("/api/v1/auth/login/confirmar", { email: EMAIL, senha: SENHA, codigo: ultimoCodigo() }),
    );
    expect(res.status).toBe(200);
    const { ticket } = (await res.json()) as { ticket: string };
    expect(ticket).toMatch(/^[0-9a-f]{64}$/);
    expect((await conferirCodigo(id, "ticket", ticket)).ok).toBe(true);
    expect((await conferirCodigo(id, "ticket", ticket)).ok).toBe(false);
    // Usou o código = e-mail comprovado.
    const u = db.prepare("SELECT email_verificado_em FROM usuarios WHERE id = ?").get(id) as {
      email_verificado_em: string | null;
    };
    expect(u.email_verificado_em).not.toBeNull();
  });

  it("código certo com senha errada não emite ticket", async () => {
    await iniciar(post("/api/v1/auth/login/iniciar", { email: EMAIL, senha: SENHA }));
    const res = await confirmar(
      post("/api/v1/auth/login/confirmar", { email: EMAIL, senha: "outra-senha-1", codigo: ultimoCodigo() }),
    );
    expect(res.status).toBe(401);
  });

  it("5 códigos errados queimam o código (mesmo o certo deixa de valer)", async () => {
    await iniciar(post("/api/v1/auth/login/iniciar", { email: EMAIL, senha: SENHA }));
    const certo = ultimoCodigo();
    const errado = certo === "000000" ? "111111" : "000000";
    const motivos: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await confirmar(
        post("/api/v1/auth/login/confirmar", { email: EMAIL, senha: SENHA, codigo: errado }),
      );
      motivos.push(((await r.json()) as { motivo: string }).motivo);
    }
    expect(motivos).toEqual(["invalido", "invalido", "invalido", "invalido", "bloqueado"]);
    const r = await confirmar(
      post("/api/v1/auth/login/confirmar", { email: EMAIL, senha: SENHA, codigo: certo }),
    );
    expect(r.status).toBe(401);
  });

  it("código expira", async () => {
    const agora = Date.now();
    const e = await emitirCodigo(id, "login", agora);
    if (!("codigo" in e)) throw new Error("esperava código");
    const r = await conferirCodigo(id, "login", e.codigo, agora + 11 * 60_000);
    expect(r).toEqual({ ok: false, motivo: "expirado" });
  });

  it(`reenvio antes de ${REENVIO_SEG}s não manda outro e-mail`, async () => {
    await iniciar(post("/api/v1/auth/login/iniciar", { email: EMAIL, senha: SENHA }));
    const res = await iniciar(post("/api/v1/auth/login/iniciar", { email: EMAIL, senha: SENHA }));
    const corpo = (await res.json()) as { reenvioEmSeg: number };
    expect(corpo.reenvioEmSeg).toBeGreaterThan(0);
    expect(enviados).toHaveLength(1);
  });
});

describe("esqueci minha senha", () => {
  it("e-mail inexistente recebe a MESMA resposta (sem enumeração) e nada é enviado", async () => {
    const a = await solicitarSenha(post("/api/v1/auth/senha/solicitar", { email: "ninguem@laudo-teste.com" }));
    const b = await solicitarSenha(post("/api/v1/auth/senha/solicitar", { email: EMAIL }));
    expect(await a.json()).toEqual(await b.json());
    expect(enviados.map((e) => e.para)).toEqual([EMAIL]);
  });

  it("código + senha nova trocam a senha e derrubam todas as sessões", async () => {
    const s1 = await criarSessao(id);
    const s2 = await criarSessao(id);
    await solicitarSenha(post("/api/v1/auth/senha/solicitar", { email: EMAIL }));
    const nova = "outra frase longa 77";
    const res = await redefinirSenha(
      post("/api/v1/auth/senha/redefinir", { email: EMAIL, codigo: ultimoCodigo(), senha: nova }),
    );
    expect(res.status).toBe(200);
    expect(await sessaoValida(s1, id)).toBe(false);
    expect(await sessaoValida(s2, id)).toBe(false);
    const u = db.prepare("SELECT senha_hash FROM usuarios WHERE id = ?").get(id) as { senha_hash: string };
    expect(await compararSenha(nova, u.senha_hash)).toBe(true);
  });

  it("senha nova fraca é recusada (400)", async () => {
    await solicitarSenha(post("/api/v1/auth/senha/solicitar", { email: EMAIL }));
    const res = await redefinirSenha(
      post("/api/v1/auth/senha/redefinir", { email: EMAIL, codigo: ultimoCodigo(), senha: "12345678" }),
    );
    expect(res.status).toBe(400);
  });

  it("sem provedor de e-mail: 503 com orientação de suporte", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const res = await solicitarSenha(post("/api/v1/auth/senha/solicitar", { email: EMAIL }));
    expect(res.status).toBe(503);
  });
});

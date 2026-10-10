import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encode } from "next-auth/jwt";
import db from "@/lib/db";
import {
  TOKEN_MAX_AGE_SEG,
  exigirUsuario,
  hashToken,
  nomeCookieSessao,
} from "@/lib/api-auth";
import { criarUsuario } from "@/lib/usuarios";

const EMAIL = "qa.apiauth@laudo.teste";
const SEGREDO = "segredo-de-teste-com-32-caracteres!!";

function requisicao(token?: string): Request {
  return new Request("http://localhost/api/v1/relatorios", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

async function tokenPara(usuarioId: number, sid?: number): Promise<string> {
  return encode({
    token: { sub: String(usuarioId), usuarioId, sid },
    secret: SEGREDO,
    salt: nomeCookieSessao(),
    maxAge: TOKEN_MAX_AGE_SEG,
  });
}

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", SEGREDO);
  vi.stubEnv("BCRYPT_ROUNDS", "4");
});

afterEach(() => {
  db.prepare("DELETE FROM sessoes WHERE usuario_id IN (SELECT id FROM usuarios WHERE email = ?)").run(
    EMAIL,
  );
  db.prepare("DELETE FROM usuarios WHERE email = ?").run(EMAIL);
  vi.unstubAllEnvs();
});

describe("exigirUsuario", () => {
  it("devolve 401 sem token", async () => {
    const r = await exigirUsuario(requisicao());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.resposta.status).toBe(401);
      expect(await r.resposta.json()).toMatchObject({ code: "NAO_AUTENTICADO" });
    }
  });

  it("devolve 401 com token adulterado", async () => {
    const r = await exigirUsuario(requisicao("invalido.adulterado.aqui"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.resposta.status).toBe(401);
  });

  it("aceita Bearer válido com sessão registrada", async () => {
    const u = (await criarUsuario("QA Auth", EMAIL, "senha-123456"))!;
    const expira = new Date(Date.now() + 3600_000).toISOString();
    const jti = Number(
      db
        .prepare("INSERT INTO sessoes (usuario_id, token_hash, expira_em) VALUES (?, ?, ?)")
        .run(u.id, "x", expira).lastInsertRowid,
    );
    const token = await tokenPara(u.id, jti);
    db.prepare("UPDATE sessoes SET token_hash = ? WHERE id = ?").run(hashToken(token), jti);

    const r = await exigirUsuario(requisicao(token));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.usuario.email).toBe(EMAIL);
  });

  it("rejeita Bearer com sessão revogada", async () => {
    const u = (await criarUsuario("QA Auth", EMAIL, "senha-123456"))!;
    const token = await tokenPara(u.id, 999999); // sid inexistente
    const r = await exigirUsuario(requisicao(token));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.resposta.status).toBe(401);
  });

  it("rejeita Bearer de usuário removido", async () => {
    const u = (await criarUsuario("QA Auth", EMAIL, "senha-123456"))!;
    const token = await tokenPara(u.id); // sem sid: pula checagem de sessoes
    db.prepare("DELETE FROM usuarios WHERE id = ?").run(u.id);
    const r = await exigirUsuario(requisicao(token));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.resposta.status).toBe(401);
  });
});

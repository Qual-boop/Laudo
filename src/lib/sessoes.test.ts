import { afterAll, beforeAll, describe, expect, it } from "vitest";
import db from "@/lib/db";
import { criarSessao, revogarSessao, revogarTodas, sessaoValida } from "@/lib/sessoes";
import { criarUsuario } from "@/lib/usuarios";
import { senhaFraca } from "@/lib/validacao";

const EMAIL = "qa.sessoes@laudo-teste.com";
let id = 0;

beforeAll(async () => {
  db.prepare("DELETE FROM usuarios WHERE email = ?").run(EMAIL);
  id = (await criarUsuario("QA Sessões", EMAIL, "frase de teste 99"))!.id;
});

afterAll(() => {
  db.prepare("DELETE FROM usuarios WHERE email = ?").run(EMAIL);
});

describe("sessões revogáveis", () => {
  it("sessão criada vale só para o próprio usuário", async () => {
    const sid = await criarSessao(id);
    expect(await sessaoValida(sid, id)).toBe(true);
    expect(await sessaoValida(sid, id + 999)).toBe(false);
  });

  it("logout revoga só a sessão daquele navegador", async () => {
    const a = await criarSessao(id);
    const b = await criarSessao(id);
    await revogarSessao(a);
    expect(await sessaoValida(a, id)).toBe(false);
    expect(await sessaoValida(b, id)).toBe(true);
  });

  it("'sair de todos' derruba todas", async () => {
    const a = await criarSessao(id);
    const b = await criarSessao(id);
    expect(await revogarTodas(id)).toBeGreaterThanOrEqual(2);
    expect(await sessaoValida(a, id)).toBe(false);
    expect(await sessaoValida(b, id)).toBe(false);
  });

  it("token sem sid (anterior a este controle) não vale", async () => {
    expect(await sessaoValida(undefined, id)).toBe(false);
    expect(await sessaoValida("abc", id)).toBe(false);
  });

  it("sessão vencida não vale", async () => {
    const sid = await criarSessao(id);
    db.prepare("UPDATE sessoes SET expira_em = ? WHERE id = ?").run(
      new Date(Date.now() - 1000).toISOString(),
      sid,
    );
    expect(await sessaoValida(sid, id)).toBe(false);
  });
});

describe("senhaFraca", () => {
  it.each(["12345678", "Senha123", "PASSWORD", "aaaaaaaa", "provafix"])("%s é fraca", (s) => {
    expect(senhaFraca(s)).toBe(true);
  });
  it.each(["frase de teste 99", "Kx9!mQ2#vL"])("%s passa", (s) => {
    expect(senhaFraca(s)).toBe(false);
  });
});

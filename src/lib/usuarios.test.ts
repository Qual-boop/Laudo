import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import db from "@/lib/db";
import {
  buscarOuCriarPorEmail,
  buscarUsuarioPorEmail,
  compararSenha,
  criarUsuario,
  hashSenha,
} from "@/lib/usuarios";

const EMAILS = [
  "qa.usuarios.1@laudo.teste",
  "qa.usuarios.2@laudo.teste",
  "qa.usuarios.3@laudo.teste",
];

beforeEach(() => {
  vi.stubEnv("BCRYPT_ROUNDS", "4");
});

afterEach(() => {
  for (const email of EMAILS) {
    db.prepare("DELETE FROM usuarios WHERE email = ?").run(email);
  }
  vi.unstubAllEnvs();
});

describe("usuarios", () => {
  it("cria usuário com senha hasheada (nunca plaintext)", async () => {
    const u = await criarUsuario("QA Um", EMAILS[0], "senha-secreta-123");
    expect(u).not.toBeNull();
    expect(u?.email).toBe(EMAILS[0]);
    expect(u?.senha_hash).not.toBe("senha-secreta-123");
    expect(await compararSenha("senha-secreta-123", u?.senha_hash ?? "")).toBe(
      true,
    );
    expect(await compararSenha("errada", u?.senha_hash ?? "")).toBe(false);
  });

  it("rejeita e-mail duplicado (mesmo com caixa diferente)", async () => {
    await criarUsuario("QA Um", EMAILS[1], "senha-secreta-123");
    expect(
      await criarUsuario("Outro", EMAILS[1].toUpperCase(), "outra-senha-123"),
    ).toBeNull();
  });

  it("normaliza e-mail para minúsculas", async () => {
    await criarUsuario("QA", EMAILS[2], "senha-secreta-123");
    expect(buscarUsuarioPorEmail(EMAILS[2].toUpperCase())?.email).toBe(
      EMAILS[2],
    );
  });

  it("buscarOuCriarPorEmail não duplica nem apaga senha", async () => {
    const criado = await criarUsuario("QA Um", EMAILS[0], "senha-secreta-123");
    const mesmo = buscarOuCriarPorEmail(EMAILS[0], "Nome Google");
    expect(mesmo?.id).toBe(criado?.id);
    expect(mesmo?.senha_hash).toBe(criado?.senha_hash);
  });

  it("hashSenha gera salts diferentes para a mesma senha", async () => {
    expect(await hashSenha("abc-12345")).not.toBe(await hashSenha("abc-12345"));
  });
});

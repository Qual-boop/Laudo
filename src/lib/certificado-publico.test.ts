import { afterEach, describe, expect, it } from "vitest";
import db from "@/lib/db";
import { carregarDadosCertificado } from "@/lib/certificado-dados";
import {
  ativarLinkPublico,
  certificadoPorToken,
  gerarTokenCertificado,
  revogarLinkPublico,
  tokenCertificadoValido,
  tokenPublicoDe,
} from "@/lib/certificado-publico";
import { criarUsuario, definirPlano } from "@/lib/usuarios";

const EMAIL = "qa.link-publico@laudo-teste.com";
const EMAIL_OUTRO = "qa.link-publico-outro@laudo-teste.com";

function limpar() {
  db.prepare("DELETE FROM usuarios WHERE email IN (?, ?)").run(EMAIL, EMAIL_OUTRO);
}

/** Dono pro + relatório com 2 achados (status escolhido) e reteste de cada. */
async function semear(status: "verificado" | "pendente" = "verificado") {
  limpar();
  const u = (await criarUsuario("QA Link", EMAIL, "senha-123456"))!;
  await definirPlano(u.id, "pro");

  const rel = db
    .prepare(
      `INSERT INTO relatorios (cliente, titulo, data, versao, risco_geral,
         total_achados, relatorio_json, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run("ACME", "Pentest externo", "2026-10-01", "1.0", "Alta", 2, "{}", u.id);
  const relatorioId = Number(rel.lastInsertRowid);

  for (const ref of ["FINDING-002", "FINDING-001"]) {
    const achado = db
      .prepare(
        `INSERT INTO achados_verificacao (relatorio_id, achado_ref, titulo, severidade, status)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(relatorioId, ref, `Achado ${ref}`, "Alta", status);
    db.prepare(
      "INSERT INTO retestes (achado_id, data_reteste, resultado) VALUES (?, ?, ?)",
    ).run(Number(achado.lastInsertRowid), "2026-10-10", "corrigido");
  }

  return { usuarioId: u.id, relatorioId };
}

afterEach(limpar);

describe("gerarTokenCertificado", () => {
  it("tem 256 bits em base64url (43 caracteres)", () => {
    const token = gerarTokenCertificado();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(tokenCertificadoValido(token)).toBe(true);
  });

  it("não repete nem segue sequência", () => {
    const tokens = new Set(Array.from({ length: 2000 }, gerarTokenCertificado));
    expect(tokens.size).toBe(2000);
  });

  it("formato inválido é recusado antes do banco", () => {
    for (const lixo of [undefined, null, 12, "", "abc", "1", "a".repeat(44), `${"a".repeat(42)}=`, `${"a".repeat(42)}/`]) {
      expect(tokenCertificadoValido(lixo)).toBe(false);
    }
  });
});

describe("ativarLinkPublico", () => {
  it("cria o token, grava na coluna e é idempotente", async () => {
    const { usuarioId, relatorioId } = await semear();
    const primeiro = await ativarLinkPublico(relatorioId, { id: usuarioId, plano: "pro" });
    expect(primeiro.ok).toBe(true);
    if (!primeiro.ok) return;

    expect(tokenCertificadoValido(primeiro.token)).toBe(true);
    expect(await tokenPublicoDe(relatorioId)).toBe(primeiro.token);

    const segundo = await ativarLinkPublico(relatorioId, { id: usuarioId, plano: "pro" });
    expect(segundo).toEqual(primeiro);
  });

  it("recusa quem não é dono, plano free e certificado pendente", async () => {
    const { usuarioId, relatorioId } = await semear();
    expect(await ativarLinkPublico(relatorioId, { id: usuarioId + 999, plano: "pro" })).toEqual({
      ok: false,
      motivo: "acesso-negado",
    });
    expect(await ativarLinkPublico(relatorioId, { id: usuarioId, plano: "free" })).toEqual({
      ok: false,
      motivo: "plano",
    });
    expect(await ativarLinkPublico(999_999_999, { id: usuarioId, plano: "pro" })).toEqual({
      ok: false,
      motivo: "nao-encontrado",
    });

    const pendente = await semear("pendente");
    expect(
      await ativarLinkPublico(pendente.relatorioId, { id: pendente.usuarioId, plano: "pro" }),
    ).toEqual({ ok: false, motivo: "pendente" });
    expect(await tokenPublicoDe(pendente.relatorioId)).toBeNull();
  });
});

describe("certificadoPorToken", () => {
  it("abre o mesmo certificado (mesmo hash) que o dono vê", async () => {
    const { usuarioId, relatorioId } = await semear();
    const link = await ativarLinkPublico(relatorioId, { id: usuarioId, plano: "pro" });
    if (!link.ok) throw new Error("link não criado");

    const publico = await certificadoPorToken(link.token);
    const doDono = await carregarDadosCertificado(relatorioId);
    expect(publico).not.toBeNull();
    expect(publico!.hash).toBe(doDono!.hash);
    expect(publico!.progresso.completo).toBe(true);
    // Nada de conta (nome/e-mail/plano do pentester) no que a página recebe.
    expect(JSON.stringify(publico)).not.toContain(EMAIL);
    expect(JSON.stringify(publico)).not.toContain("QA Link");
  });

  it("token desconhecido ou malformado não abre nada", async () => {
    await semear();
    expect(await certificadoPorToken(gerarTokenCertificado())).toBeNull();
    expect(await certificadoPorToken("../../etc/passwd")).toBeNull();
  });

  it("para de abrir se o dono cai para free ou um achado volta a falhar", async () => {
    const { usuarioId, relatorioId } = await semear();
    const link = await ativarLinkPublico(relatorioId, { id: usuarioId, plano: "pro" });
    if (!link.ok) throw new Error("link não criado");

    await definirPlano(usuarioId, "free");
    expect(await certificadoPorToken(link.token)).toBeNull();
    await definirPlano(usuarioId, "pro");
    expect(await certificadoPorToken(link.token)).not.toBeNull();

    db.prepare(
      "UPDATE achados_verificacao SET status = 'nao-corrigido' WHERE relatorio_id = ? AND achado_ref = 'FINDING-001'",
    ).run(relatorioId);
    expect(await certificadoPorToken(link.token)).toBeNull();
  });

  it("plano pago expirado conta como free", async () => {
    const { usuarioId, relatorioId } = await semear();
    const link = await ativarLinkPublico(relatorioId, { id: usuarioId, plano: "pro" });
    if (!link.ok) throw new Error("link não criado");

    db.prepare("UPDATE usuarios SET plano_expira_em = ? WHERE id = ?").run(
      "2020-01-01T00:00:00.000Z",
      usuarioId,
    );
    expect(await certificadoPorToken(link.token)).toBeNull();
  });
});

describe("revogarLinkPublico", () => {
  it("mata o token antigo; reativar gera outro", async () => {
    const { usuarioId, relatorioId } = await semear();
    const antes = await ativarLinkPublico(relatorioId, { id: usuarioId, plano: "pro" });
    if (!antes.ok) throw new Error("link não criado");

    expect(await revogarLinkPublico(relatorioId, usuarioId)).toEqual({ ok: true });
    expect(await tokenPublicoDe(relatorioId)).toBeNull();
    expect(await certificadoPorToken(antes.token)).toBeNull();

    const depois = await ativarLinkPublico(relatorioId, { id: usuarioId, plano: "pro" });
    if (!depois.ok) throw new Error("link não recriado");
    expect(depois.token).not.toBe(antes.token);
    expect(await certificadoPorToken(antes.token)).toBeNull();
    expect(await certificadoPorToken(depois.token)).not.toBeNull();
  });

  it("só o dono revoga", async () => {
    const { usuarioId, relatorioId } = await semear();
    const link = await ativarLinkPublico(relatorioId, { id: usuarioId, plano: "pro" });
    if (!link.ok) throw new Error("link não criado");

    const outro = (await criarUsuario("QA Outro", EMAIL_OUTRO, "senha-123456"))!;
    expect(await revogarLinkPublico(relatorioId, outro.id)).toEqual({
      ok: false,
      motivo: "acesso-negado",
    });
    expect(await tokenPublicoDe(relatorioId)).toBe(link.token);
  });
});

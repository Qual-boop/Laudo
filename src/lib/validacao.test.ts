import { describe, expect, it } from "vitest";
import {
  esquemaAchadoIdQuery,
  esquemaCadastro,
  esquemaGerar,
  esquemaId,
  esquemaLogin,
  esquemaPaginacao,
  esquemaReteste,
  formatarErroZod,
} from "@/lib/validacao";

describe("esquemaCadastro", () => {
  it("aceita cadastro válido", () => {
    const r = esquemaCadastro.safeParse({
      nome: " Maria ",
      email: "MARIA@exemplo.com",
      senha: "segredo-123",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("maria@exemplo.com");
  });

  it("rejeita senha curta e e-mail inválido", () => {
    expect(esquemaCadastro.safeParse({ nome: "A", email: "x", senha: "curta" }).success).toBe(
      false,
    );
  });
});

describe("esquemaLogin", () => {
  it("rejeita sem senha", () => {
    expect(
      esquemaLogin.safeParse({ email: "a@b.co", senha: "" }).success,
    ).toBe(false);
  });
});

describe("esquemaGerar (compatível com o contrato antigo)", () => {
  it("rejeita achados vazios com a mensagem esperada", () => {
    const r = esquemaGerar.safeParse({ achados: [] });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(formatarErroZod(r.error).code).toBe("VALIDACAO");
      expect(formatarErroZod(r.error).error).toContain("ao menos um achado");
    }
  });

  it("rejeita achados sem título nem descrição", () => {
    const r = esquemaGerar.safeParse({ achados: [{ titulo: "  " }] });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(formatarErroZod(r.error).error).toContain("título ou descrição");
    }
  });

  it("converte corpo sem array em erro de achado", () => {
    const r = esquemaGerar.safeParse({ achados: "nada" });
    expect(r.success).toBe(false);
  });

  it("troca severidade desconhecida por Media (não rejeita)", () => {
    const r = esquemaGerar.safeParse({
      achados: [{ titulo: "A", severidade: "apocalíptico" }],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.achados[0]?.severidade).toBe("Media");
  });

  it("limita a 50 achados", () => {
    const achados = Array.from({ length: 51 }, (_, i) => ({ titulo: `A${i}` }));
    expect(esquemaGerar.safeParse({ achados }).success).toBe(false);
  });
});

describe("esquemaReteste", () => {
  it("aceita reteste válido", () => {
    const r = esquemaReteste.safeParse({
      achadoId: 3,
      resultado: "corrigido",
      evidencia: "print do 400",
      dataReteste: "2026-10-21",
    });
    expect(r.success).toBe(true);
  });

  it("rejeita achadoId ausente, resultado inválido e evidência vazia", () => {
    expect(
      esquemaReteste.safeParse({ resultado: "corrigido", evidencia: "x" }).success,
    ).toBe(false);
    expect(
      esquemaReteste.safeParse({ achadoId: 1, resultado: "talvez", evidencia: "x" }).success,
    ).toBe(false);
    expect(
      esquemaReteste.safeParse({ achadoId: 1, resultado: "corrigido", evidencia: "  " }).success,
    ).toBe(false);
  });
});

describe("esquemaPaginacao / ids", () => {
  it("usa padrões 50/1 e capa o limit em 200", () => {
    expect(esquemaPaginacao.parse({})).toEqual({ limit: 50, page: 1 });
    expect(esquemaPaginacao.parse({ limit: "9999" }).limit).toBe(50);
    expect(esquemaPaginacao.parse({ limit: "abc" }).limit).toBe(50);
  });

  it("esquemaId aceita '4' e rejeita 'abc'", () => {
    expect(esquemaId.safeParse("4").success).toBe(true);
    expect(esquemaId.safeParse("abc").success).toBe(false);
  });

  it("achadoId ausente vira undefined; 'abc' é erro", () => {
    expect(esquemaAchadoIdQuery.safeParse(null).success).toBe(true);
    expect(esquemaAchadoIdQuery.safeParse("abc").success).toBe(false);
    expect(esquemaAchadoIdQuery.safeParse("7").data).toBe(7);
  });
});

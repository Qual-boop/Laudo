import { describe, expect, it } from "vitest";
import { BIBLIOTECA, CATEGORIAS, achadoDoModelo } from "@/lib/biblioteca-achados";

describe("biblioteca de achados", () => {
  it("tem ids únicos, CWE válido e texto pronto", () => {
    const ids = BIBLIOTECA.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of BIBLIOTECA) {
      expect(m.cwe).toMatch(/^CWE-\d+$/);
      expect(m.titulo.trim()).not.toBe("");
      expect(m.descricao.length).toBeGreaterThan(80);
      expect(CATEGORIAS).toContain(m.categoria);
    }
  });

  it("usa todas as categorias", () => {
    expect(new Set(BIBLIOTECA.map((m) => m.categoria))).toEqual(new Set(CATEGORIAS));
  });

  it("preenche um achado do formulário a partir do modelo", () => {
    const a = achadoDoModelo("idor");
    expect(a).toMatchObject({ titulo: expect.stringContaining("IDOR"), severidade: "Alta", cwe: "CWE-639" });
    expect(a?.evidencia).toBe("");
    expect(achadoDoModelo("nao-existe")).toBeNull();
  });
});

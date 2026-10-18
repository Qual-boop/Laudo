import { describe, expect, it } from "vitest";
import { normalizarCwe, normalizarRelatorio } from "@/lib/relatorio";
import type { RelatorioEntrada } from "@/lib/tipos";

const ENTRADA: RelatorioEntrada = {
  cliente: "Cliente",
  titulo: "T",
  escopo: "",
  periodo: "",
  limitacoes: "",
  ferramentas: "",
  achados: [
    { titulo: "SQLi", severidade: "Alta", cwe: "CWE-89", descricao: "", evidencia: "", confianca: "Alta", dataRetesteSugerida: "" },
  ],
};

describe("normalizarCwe", () => {
  it("reduz o texto longo da IA ao identificador (o salvar aceita até 20 caracteres)", () => {
    expect(
      normalizarCwe("CWE-89: Improper Neutralization of Special Elements used in an SQL Command ('SQL Injection')"),
    ).toBe("CWE-89");
    expect(normalizarCwe("cwe 079")).toBe("CWE-79");
    expect(normalizarCwe("639")).toBe("CWE-639");
    expect(normalizarCwe("")).toBe("");
    expect(normalizarCwe("Não se aplica a este caso específico")).toHaveLength(20);
  });

  it("o relatório normalizado já sai salvável", () => {
    const r = normalizarRelatorio(
      {
        achados: [
          {
            titulo: "SQLi",
            severidade: "Alta",
            cwe: "CWE-89: Improper Neutralization of Special Elements used in an SQL Command",
            cvss: { score: 9.9, vetor: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N" },
          },
        ],
      },
      ENTRADA,
    );
    expect(r.achados[0].cwe).toBe("CWE-89");
    // e a nota vem da fórmula, não do 9.9 da IA
    expect(r.achados[0].cvss.score).toBe(8.1);
  });
});

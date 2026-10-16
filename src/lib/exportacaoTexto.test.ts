import { describe, expect, it } from "vitest";
import { gerarExportacaoTexto } from "@/lib/exportacao";
import type { Relatorio } from "@/lib/tipos";

describe("gerarExportacaoTexto", () => {
  it("não quebra com relatório parcial (entrada aceita pelo schema)", () => {
    const parcial = {
      capa: {
        cliente: "Acme",
        titulo: "Smoke",
        data: "2026-10-15",
        versao: "1.0",
      },
      sumarioExecutivo: { riscoGeral: "Baixo" },
      achados: [{ id: "FINDING-001", titulo: "Achado parcial", severidade: "Baixa" }],
    } as unknown as Relatorio;

    const texto = gerarExportacaoTexto(parcial);
    expect(texto).toContain("Smoke — Acme (2026-10-15)");
    expect(texto).toContain("Risco geral: Baixo · 1 achado(s)");
    expect(texto).toContain("[Baixa] Achado parcial");
    expect(texto).not.toContain("undefined");
  });

  it("inclui CVSS quando presente", () => {
    const completo = {
      capa: {
        cliente: "Acme",
        titulo: "Completo",
        data: "2026-10-15",
        versao: "1.0",
      },
      sumarioExecutivo: { riscoGeral: "Crítico", totalAchados: 1 },
      achados: [
        {
          id: "FINDING-001",
          titulo: "SQLi",
          severidade: "Critica",
          cvss: { score: 9.8, vetor: "AV:N/AC:L" },
        },
      ],
      conclusao: "Corrigir com urgência.",
    } as unknown as Relatorio;

    const texto = gerarExportacaoTexto(completo);
    expect(texto).toContain("[Critica] SQLi (CVSS 9.8)");
    expect(texto).toContain("Corrigir com urgência.");
  });
});

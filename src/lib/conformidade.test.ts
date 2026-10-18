import { describe, expect, it } from "vitest";
import { contarEstados, montarQuadro, type DadosConformidade } from "@/lib/conformidade";

const HOJE = new Date(2026, 9, 18);

const BASE: DadosConformidade = {
  cliente: "Acme",
  titulo: "Pentest Web",
  data: "2026-10-06",
  periodo: "02/10 a 06/10",
  escopo: "portal.acme.com.br",
  metodologia: "OWASP WSTG e PTES, testes autenticados e não autenticados.",
  achados: [
    { ref: "FINDING-001", severidade: "Critica", status: "verificado", dataReteste: "2026-10-09", resultado: "corrigido", entregueEm: "2026-10-06", cvss: 9.8 },
    { ref: "FINDING-002", severidade: "Alta", status: "verificado", dataReteste: "2026-10-14", resultado: "corrigido", entregueEm: "2026-10-06", cvss: 8.1 },
  ],
  hashCertificado: "b5c6f31304e97ed25cb3ea636097a41ec5ca475b74591346643343d9d7062e44",
};

function item(marcos: ReturnType<typeof montarQuadro>, ref: string) {
  return marcos.flatMap((m) => m.itens).find((i) => i.referencia === ref)!;
}

describe("quadro de conformidade", () => {
  it("ciclo completo evidencia o 11.4.4 e cita o hash do certificado", () => {
    const q = montarQuadro(BASE, HOJE);
    const r = item(q, "11.4.4");
    expect(r.estado).toBe("evidenciado");
    expect(r.evidencia).toContain("Todos os 2 achados");
    expect(r.evidencia).toContain("b5c6f31304e97ed2");
    expect(item(q, "A.8.8").estado).toBe("evidenciado");
    expect(item(q, "Art. 46").estado).toBe("evidenciado");
  });

  it("achado em aberto deixa o ciclo parcial e lista o que falta", () => {
    const d = {
      ...BASE,
      hashCertificado: null,
      achados: [
        BASE.achados[0],
        { ...BASE.achados[1], status: "pendente" as const, dataReteste: null, resultado: null },
      ],
    };
    const r = item(montarQuadro(d, HOJE), "11.4.4");
    expect(r.estado).toBe("parcial");
    expect(r.evidencia).toContain("Em aberto: FINDING-002");
  });

  it("achado vencido sem correção derruba a correção tempestiva (BCB)", () => {
    const d = {
      ...BASE,
      achados: [{ ...BASE.achados[0], status: "pendente" as const, dataReteste: null, resultado: null, entregueEm: "2026-09-01" }],
    };
    expect(item(montarQuadro(d, HOJE), "Correção tempestiva").estado).toBe("sem-evidencia");
  });

  it("teste com mais de 12 meses e sem metodologia aparecem como lacunas", () => {
    const q = montarQuadro({ ...BASE, data: "2025-06-01", metodologia: "" }, HOJE);
    expect(item(q, "11.4.2 / 11.4.3").estado).toBe("parcial");
    expect(item(q, "11.4.2 / 11.4.3").evidencia).toContain("mais de 12 meses");
    expect(item(q, "11.4.1").estado).toBe("sem-evidencia");
  });

  it("independência do testador nunca é presumida (BCB fica parcial)", () => {
    expect(item(montarQuadro(BASE, HOJE), "Testes de intrusão").estado).toBe("parcial");
  });

  it("conta os estados de todos os marcos", () => {
    const c = contarEstados(montarQuadro(BASE, HOJE));
    // PCI 4 + ISO 2 + LGPD 2 + BCB 2
    expect(c.evidenciado + c.parcial + c["sem-evidencia"]).toBe(10);
  });
});

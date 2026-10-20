import { describe, expect, it } from "vitest";
import { celula, gerarCsv } from "@/lib/csv";
import { normalizarRelatorio, type Documento } from "@/lib/documento";
import { cssTexto, dataBr, estiloPagina, nomeArquivo } from "@/lib/documento-formato";
import { corLegivel, logoValido } from "@/lib/marca";
import { PRECOS_CENTAVOS, formatarReais, precoMensal } from "@/lib/planos";

describe("preços", () => {
  it("Pro 22,90 e Team 49,90; anual = 12 meses com 20% off", () => {
    expect(precoMensal("pro")).toBe("R$ 22,90");
    expect(precoMensal("team")).toBe("R$ 49,90");
    for (const p of ["pro", "team"] as const) {
      expect(PRECOS_CENTAVOS[p].anual).toBe(Math.round(PRECOS_CENTAVOS[p].mensal * 12 * 0.8));
    }
    expect(formatarReais(21984)).toBe("R$ 219,84");
  });
});

describe("normalizarRelatorio", () => {
  it("completa JSON parcial sem quebrar e recalcula contagens", () => {
    const r = normalizarRelatorio({
      capa: { cliente: "Acme" },
      achados: [{ titulo: "XSS", severidade: "Alta" }, { severidade: "inventada" }],
    });
    expect(r.capa.cliente).toBe("Acme");
    expect(r.capa.titulo).toMatch(/Teste de Intrusão/);
    expect(r.achados.map((a) => a.id)).toEqual(["FINDING-001", "FINDING-002"]);
    expect(r.achados[1].severidade).toBe("Media");
    expect(Number.isNaN(r.achados[0].cvss.score)).toBe(true);
    expect(r.sumarioExecutivo.resumoPorSeveridade).toEqual({ critica: 0, alta: 1, media: 1, baixa: 0 });
  });
});

describe("formatação do documento", () => {
  it("dataBr e nomeArquivo", () => {
    expect(dataBr("2026-10-20")).toBe("20/10/2026");
    expect(dataBr("2026-10-20T13:00:00Z")).toBe("20/10/2026");
    expect(nomeArquivo("Pentest", "Ação & Cia Ltda.", "2026-10-20")).toBe("Pentest-Acao-Cia-Ltda-2026-10-20");
  });

  it("cssTexto não deixa fechar o <style> nem a string", () => {
    const s = cssTexto('Acme"; } body { display:none } </style><script>x</script>');
    expect(s).not.toContain("</style");
    expect(s).not.toMatch(/[^\\]";/);
    expect(estiloPagina({ topoEsquerda: "a", topoDireita: "b", rodapeEsquerda: "c" })).toContain(
      'counter(page) " de " counter(pages)',
    );
  });
});

describe("marca", () => {
  const png = "data:image/png;base64," + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString("base64");
  it("aceita PNG de verdade e recusa SVG, tipo trocado e base64 inválido", () => {
    expect(logoValido(png)).toBe(png);
    expect(logoValido("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")).toBeNull();
    expect(logoValido("data:image/jpeg;base64," + png.split(",")[1])).toBeNull();
    expect(logoValido("javascript:alert(1)")).toBeNull();
  });

  it("corLegivel escurece cor clara até contraste ≥ 4,5 no papel branco", () => {
    expect(corLegivel("#047857")).toBe("#047857");
    expect(corLegivel("#ffff00")).not.toBe("#ffff00");
    expect(corLegivel("lixo")).toBe("#047857");
  });
});

describe("CSV", () => {
  it("neutraliza fórmula (CSV injection) e escapa ; aspas e quebras", () => {
    expect(celula("=HYPERLINK(\"http://x\")")).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(celula("+cmd")).toBe("'+cmd");
    expect(celula("a;b")).toBe('"a;b"');
    expect(celula("linha1\nlinha2")).toBe('"linha1\nlinha2"');
  });

  it("gera BOM, cabeçalho e uma linha por achado", () => {
    const relatorio = normalizarRelatorio({
      capa: { cliente: "Acme" },
      achados: [{ id: "FINDING-001", titulo: "SQLi", severidade: "Critica", cvss: { score: 9.8, vetor: "CVSS:3.1/AV:N" } }],
    });
    const doc: Documento = {
      id: 1,
      relatorio,
      criadoEm: "2026-10-20",
      planoDono: "pro",
      marca: null,
      marcaDagua: false,
      achados: relatorio.achados.map((a) => ({ ...a, verificacao: null, prazo: null })),
      resumo: { total: 1, porSeveridade: { Critica: 1, Alta: 0, Media: 0, Baixa: 0 }, verificados: 0, naoCorrigidos: 0, pendentes: 1, atrasados: 0 },
    };
    const csv = gerarCsv(doc);
    expect(csv.startsWith("﻿ID;Título;Severidade")).toBe(true);
    expect(csv).toContain("FINDING-001;SQLi;Crítica;9,8;CVSS:3.1/AV:N");
    expect(csv.trim().split("\r\n")).toHaveLength(2);
  });
});

import { describe, expect, it } from "vitest";
import { PRAZO_DIAS, rotuloPrazo, situacaoPrazo } from "@/lib/prazos";

const HOJE = new Date(2026, 9, 17); // 17/10/2026, hora local

describe("situacaoPrazo", () => {
  it("conta o prazo da severidade a partir da entrega", () => {
    const s = situacaoPrazo("Alta", "2026-10-07 14:30:00", HOJE);
    expect(s).toEqual({ venceEm: "2026-11-06", dias: 20, estado: "no-prazo" });
  });

  it("avisa quando está perto de vencer", () => {
    expect(situacaoPrazo("Critica", "2026-10-11", HOJE)?.estado).toBe("vence-logo"); // vence 18/10
    expect(situacaoPrazo("Alta", "2026-09-20", HOJE)?.estado).toBe("vence-logo"); // vence 20/10
  });

  it("marca atraso com os dias corridos", () => {
    const s = situacaoPrazo("Critica", "2026-10-01T09:00:00.000Z", HOJE);
    expect(s?.estado).toBe("atrasado");
    expect(s?.dias).toBe(-9);
    expect(rotuloPrazo(s!)).toBe("atrasado há 9 dias");
  });

  it("timestamp do banco (UTC) conta pelo dia local de quem vê", () => {
    // Entregue "agora" segundo o banco, que grava em UTC sem fuso.
    const agora = new Date(2026, 9, 17, 22, 30); // 22h30 locais
    const gravado = agora.toISOString().replace("T", " ").slice(0, 19); // "AAAA-MM-DD HH:MM:SS" em UTC
    const s = situacaoPrazo("Alta", gravado, agora);
    expect(s?.dias).toBe(30);
    expect(s?.venceEm).toBe("2026-11-16");
  });

  it("ignora data inválida", () => {
    expect(situacaoPrazo("Media", "", HOJE)).toBeNull();
    expect(situacaoPrazo("Media", "ontem", HOJE)).toBeNull();
  });

  it("rótulos de borda", () => {
    expect(rotuloPrazo({ venceEm: "", dias: 0, estado: "vence-logo" })).toBe("vence hoje");
    expect(rotuloPrazo({ venceEm: "", dias: 1, estado: "vence-logo" })).toBe("vence amanhã");
    expect(rotuloPrazo({ venceEm: "", dias: -1, estado: "atrasado" })).toBe("atrasado há 1 dia");
  });

  it("prazos crescem com a severidade menor", () => {
    expect(PRAZO_DIAS.Critica).toBeLessThan(PRAZO_DIAS.Alta);
    expect(PRAZO_DIAS.Alta).toBeLessThan(PRAZO_DIAS.Media);
    expect(PRAZO_DIAS.Media).toBeLessThan(PRAZO_DIAS.Baixa);
  });
});

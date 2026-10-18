import { describe, expect, it } from "vitest";
import { dobrarLinha, escaparIcs, eventosDaAgenda, gerarIcs } from "@/lib/agenda";
import type { AchadoVerificavel } from "@/lib/tipos";

const HOJE = new Date(2026, 9, 18);

function achado(over: Partial<AchadoVerificavel>): AchadoVerificavel {
  return {
    id: 7,
    relatorio_id: 1,
    cliente: "Acme, Pagamentos; Ltda.",
    achado_ref: "FINDING-002",
    titulo: "IDOR no endpoint de faturas",
    severidade: "Alta",
    cwe: "CWE-639",
    confianca: "Alta",
    data_reteste_sugerida: "2026-10-25",
    status: "pendente",
    criado_em: "2026-10-06",
    ultimo_reteste: null,
    total_retestes: 0,
    ...over,
  };
}

describe("agenda de retestes", () => {
  it("cria reteste sugerido e vencimento do prazo, em ordem de data", () => {
    const e = eventosDaAgenda([achado({})], HOJE);
    expect(e.map((x) => [x.data, x.titulo.split(":")[0]])).toEqual([
      ["2026-10-25", "Reteste"],
      ["2026-11-05", "Prazo de correção"],
    ]);
  });

  it("ignora verificados e datas inválidas", () => {
    expect(eventosDaAgenda([achado({ status: "verificado" })], HOJE)).toEqual([]);
    const e = eventosDaAgenda([achado({ data_reteste_sugerida: "amanhã" })], HOJE);
    expect(e).toHaveLength(1);
  });

  it("gera iCalendar válido: CRLF, dia inteiro, alarme e escape", () => {
    const ics = gerarIcs(eventosDaAgenda([achado({})], HOJE), new Date("2026-10-18T12:00:00Z"));
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261025");
    expect(ics).toContain("DTEND;VALUE=DATE:20261026");
    expect(ics).toContain("TRIGGER:-P1D");
    expect(ics).toContain("DTSTAMP:20261018T120000Z");
    expect(ics).toContain("Acme\\, Pagamentos\\; Ltda.");
    expect(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });

  it("escapa e dobra conforme a RFC 5545", () => {
    expect(escaparIcs("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    const longa = `SUMMARY:${"ção ".repeat(40)}`;
    const dobrada = dobrarLinha(longa);
    expect(dobrada.split("\r\n ").join("")).toBe(longa);
  });
});

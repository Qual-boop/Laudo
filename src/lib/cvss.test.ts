import { describe, expect, it } from "vitest";
import { arredondarCima, calcularCvss, lerVetor, severidadeDaNota } from "@/lib/cvss";

/* Notas de referência conferidas na calculadora oficial do FIRST (v3.1). */
const REFERENCIA: [string, number][] = [
  ["CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", 9.8],
  ["CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H", 10.0],
  ["CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N", 8.1],
  ["CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N", 6.1],
  ["CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H", 7.8],
  ["CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N", 5.9],
  ["CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N", 5.3],
  ["CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:H", 7.2],
  ["CVSS:3.1/AV:P/AC:H/PR:H/UI:R/S:U/C:L/I:N/A:N", 1.6],
  ["CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:H/A:H", 9.9],
  ["CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N", 0.0],
];

describe("CVSS 3.1", () => {
  it.each(REFERENCIA)("%s = %s", (vetor, nota) => {
    expect(calcularCvss(vetor)?.score).toBe(nota);
  });

  it("aceita 3.0, sem prefixo e fora de ordem, devolvendo o vetor canônico", () => {
    expect(calcularCvss("CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H")?.vetor).toBe(
      "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    );
    expect(calcularCvss("C:H/I:H/A:H/AV:N/AC:L/PR:L/UI:N/S:U")?.score).toBe(8.8);
  });

  it("recusa vetor incompleto ou inválido", () => {
    expect(lerVetor("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H")).toBeNull();
    expect(lerVetor("CVSS:3.1/AV:X/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H")).toBeNull();
    expect(lerVetor("")).toBeNull();
    expect(lerVetor("alto")).toBeNull();
  });

  it("arredonda para cima sem erro de ponto flutuante", () => {
    expect(arredondarCima(4.0)).toBe(4.0);
    // Ruído de ponto flutuante abaixo de 1e-5 não sobe a nota (spec, Apêndice A).
    expect(arredondarCima(4.000001)).toBe(4.0);
    expect(arredondarCima(4.00001)).toBe(4.1);
    expect(arredondarCima(4.02)).toBe(4.1);
  });

  it("faixas qualitativas", () => {
    expect(severidadeDaNota(0)).toBeNull();
    expect(severidadeDaNota(3.9)).toBe("Baixa");
    expect(severidadeDaNota(4.0)).toBe("Media");
    expect(severidadeDaNota(7.0)).toBe("Alta");
    expect(severidadeDaNota(9.0)).toBe("Critica");
  });
});

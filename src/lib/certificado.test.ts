import { describe, expect, it } from "vitest";
import {
  formatarHash,
  hashCertificado,
  progressoCertificado,
  serializarCanonico,
  type AchadoCertificado,
  type DadosCertificado,
} from "@/lib/certificado";

function achado(sobrescrever: Partial<AchadoCertificado> = {}): AchadoCertificado {
  return {
    ref: "FINDING-001",
    titulo: "SQL Injection no login",
    severidade: "Critica",
    status: "verificado",
    dataReteste: "2026-10-05",
    resultado: "corrigido",
    ...sobrescrever,
  };
}

function dados(sobrescrever: Partial<DadosCertificado> = {}): DadosCertificado {
  return {
    relatorio: {
      id: 12,
      cliente: "ACME",
      titulo: "Teste de intrusão",
      data: "2026-10-01",
      versao: "1.0",
    },
    achados: [achado()],
    emitidoEm: "2026-10-10",
    ...sobrescrever,
  };
}

describe("serializarCanonico", () => {
  it("ordena as chaves, então a ordem de montagem não muda a string", () => {
    expect(serializarCanonico({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(serializarCanonico({ a: 2, b: 1 })).toBe(serializarCanonico({ b: 1, a: 2 }));
  });

  it("ordena chaves aninhadas também", () => {
    const um = { z: { y: 1, x: 2 }, a: [3, { c: 1, b: 2 }] };
    const outro = { a: [3, { b: 2, c: 1 }], z: { x: 2, y: 1 } };
    expect(serializarCanonico(um)).toBe(serializarCanonico(outro));
  });

  it("preserva a ordem de arrays — lista é ordem, não conjunto", () => {
    expect(serializarCanonico([1, 2])).not.toBe(serializarCanonico([2, 1]));
  });

  it("trata undefined como null", () => {
    expect(serializarCanonico(undefined)).toBe("null");
    expect(serializarCanonico({ a: undefined })).toBe('{"a":null}');
  });
});

describe("hashCertificado", () => {
  it("é determinístico para os mesmos dados", () => {
    expect(hashCertificado(dados())).toBe(hashCertificado(dados()));
  });

  it("não muda com a ordem dos achados", () => {
    const base = dados({
      achados: [
        achado({ ref: "FINDING-001" }),
        achado({ ref: "FINDING-002", titulo: "XSS refletido" }),
      ],
    });
    const invertido = dados({ achados: [...base.achados].reverse() });
    expect(hashCertificado(base)).toBe(hashCertificado(invertido));
  });

  it("muda quando o status de um achado muda", () => {
    const antes = hashCertificado(dados());
    const depois = hashCertificado(
      dados({
        achados: [achado({ status: "nao-corrigido", resultado: "nao-corrigido" })],
      }),
    );
    expect(depois).not.toBe(antes);
  });

  it("muda quando a data de emissão muda", () => {
    expect(hashCertificado(dados({ emitidoEm: "2026-10-11" }))).not.toBe(
      hashCertificado(dados()),
    );
  });

  it("muda quando o relatório muda", () => {
    expect(hashCertificado(dados({ relatorio: { ...dados().relatorio, id: 13 } }))).not.toBe(
      hashCertificado(dados()),
    );
  });

  it("devolve sha-256 em hex (64 caracteres)", () => {
    expect(hashCertificado(dados())).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("formatarHash", () => {
  it("quebra em 8 blocos de 8 caracteres", () => {
    const hash = "a".repeat(64);
    expect(formatarHash(hash)).toBe(`${"a".repeat(8)} `.repeat(8).trim());
  });

  it("devolve a string original quando não há o que quebrar", () => {
    expect(formatarHash("")).toBe("");
  });
});

describe("progressoCertificado", () => {
  it("conta por status", () => {
    const p = progressoCertificado([
      achado({ ref: "A" }),
      achado({ ref: "B", status: "pendente", dataReteste: null, resultado: null }),
      achado({ ref: "C", status: "nao-corrigido", resultado: "parcial" }),
      achado({ ref: "D" }),
    ]);

    expect(p).toMatchObject({
      total: 4,
      verificados: 2,
      pendentes: 1,
      naoCorrigidos: 1,
      percentual: 50,
      completo: false,
    });
  });

  it("só fica completo com todos verificados", () => {
    expect(progressoCertificado([achado(), achado({ ref: "B" })]).completo).toBe(true);
    expect(
      progressoCertificado([achado(), achado({ ref: "B", status: "pendente" })]).completo,
    ).toBe(false);
  });

  it("lista vazia nunca libera o certificado", () => {
    const p = progressoCertificado([]);
    expect(p.completo).toBe(false);
    expect(p.percentual).toBe(0);
    expect(p.total).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { hashCertificado, progressoCertificado } from "@/lib/certificado";
import { CERTIFICADO_EXEMPLO, HASH_EXEMPLO } from "@/lib/certificado-exemplo";

describe("certificado de exemplo da landing", () => {
  it("exibe o hash real dos dados mostrados", () => {
    expect(hashCertificado(CERTIFICADO_EXEMPLO)).toBe(HASH_EXEMPLO);
  });

  it("só mostra certificado emitível (100% verificado)", () => {
    expect(progressoCertificado(CERTIFICADO_EXEMPLO.achados).completo).toBe(true);
  });
});

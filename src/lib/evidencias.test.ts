import { describe, expect, it } from "vitest";
import { MAX_BYTES_EVIDENCIA, MAX_EVIDENCIAS_POR_ACHADO, tipoDaImagem, validarEvidencia } from "@/lib/evidencias";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');
const HTML_COMO_PNG = new TextEncoder().encode("<html><script>alert(1)</script></html>");

describe("evidências", () => {
  it("identifica PNG, JPEG e WebP pelos bytes", () => {
    expect(tipoDaImagem(PNG)).toBe("image/png");
    expect(tipoDaImagem(JPG)).toBe("image/jpeg");
    expect(tipoDaImagem(WEBP)).toBe("image/webp");
  });

  it("recusa SVG e HTML disfarçado (vetores de XSS)", () => {
    expect(tipoDaImagem(SVG)).toBeNull();
    expect(validarEvidencia(HTML_COMO_PNG, 0)).toEqual({ ok: false, problema: "tipo" });
  });

  it("aplica tamanho, vazio e limite por achado", () => {
    expect(validarEvidencia(new Uint8Array(0), 0)).toEqual({ ok: false, problema: "vazia" });
    const grande = new Uint8Array(MAX_BYTES_EVIDENCIA + 1);
    grande.set(PNG);
    expect(validarEvidencia(grande, 0)).toEqual({ ok: false, problema: "grande" });
    expect(validarEvidencia(PNG, MAX_EVIDENCIAS_POR_ACHADO)).toEqual({ ok: false, problema: "limite" });
    expect(validarEvidencia(PNG, 0)).toEqual({ ok: true, mime: "image/png" });
  });
});

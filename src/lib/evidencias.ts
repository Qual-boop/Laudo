/**
 * Prints de evidência. A tarja (retângulos sobre dados sensíveis) é
 * aplicada no navegador, antes do envio: o servidor só recebe a imagem
 * já tarjada e re-codificada (o canvas descarta EXIF/GPS). Aqui ficam as
 * regras que o servidor impõe de qualquer jeito.
 */

export const MAX_BYTES_EVIDENCIA = 2.5 * 1024 * 1024;
export const MAX_EVIDENCIAS_POR_ACHADO = 10;
export const MAX_LEGENDA = 300;

export type MimeImagem = "image/png" | "image/jpeg" | "image/webp";

/**
 * Tipo pelos bytes (magic number), não pela extensão nem pelo Content-Type
 * declarado. SVG, HTML e o resto são recusados — imagem servida do nosso
 * domínio não pode virar vetor de XSS.
 */
export function tipoDaImagem(b: Uint8Array): MimeImagem | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) {
    return "image/png";
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // RIFF
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // WEBP
  ) {
    return "image/webp";
  }
  return null;
}

export type ProblemaEvidencia = "vazia" | "grande" | "tipo" | "limite";

export function validarEvidencia(bytes: Uint8Array, jaExistentes: number): { ok: true; mime: MimeImagem } | { ok: false; problema: ProblemaEvidencia } {
  if (bytes.length === 0) return { ok: false, problema: "vazia" };
  if (bytes.length > MAX_BYTES_EVIDENCIA) return { ok: false, problema: "grande" };
  if (jaExistentes >= MAX_EVIDENCIAS_POR_ACHADO) return { ok: false, problema: "limite" };
  const mime = tipoDaImagem(bytes);
  return mime ? { ok: true, mime } : { ok: false, problema: "tipo" };
}

export const MENSAGEM_PROBLEMA: Record<ProblemaEvidencia, string> = {
  vazia: "O arquivo está vazio.",
  grande: "Imagem maior que 2,5 MB. Recorte o print ou reduza a resolução.",
  tipo: "Envie PNG, JPEG ou WebP.",
  limite: `Este achado já tem ${MAX_EVIDENCIAS_POR_ACHADO} evidências. Remova uma para adicionar outra.`,
};

export type EvidenciaResumo = {
  id: number;
  legenda: string;
  mime: MimeImagem;
  tamanho: number;
  criado_em: string;
  autor: string;
};

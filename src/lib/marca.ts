import { z } from "zod";
import { buscarUm, executar } from "@/lib/banco";

/**
 * Marca própria no PDF (Pro/Team): o relatório sai com o nome, a cor, o
 * logo e o responsável técnico da consultoria — o Provafix aparece só numa
 * linha discreta de rodapé.
 *
 * O logo fica no banco como data URL (PNG/JPEG/WebP, ≤ 200 KB): o
 * navegador já reduz a imagem antes de enviar. SVG é recusado de propósito
 * (pode carregar script; o tipo é conferido pelos bytes, não pelo nome).
 */

export type Marca = {
  nome: string | null;
  cor: string | null;
  logo: string | null;
  responsavel: string | null;
  contato: string | null;
};

export const MARCA_VAZIA: Marca = { nome: null, cor: null, logo: null, responsavel: null, contato: null };

/** Cor padrão do documento quando não há marca: o verde do Provafix escurecido para papel. */
export const COR_PADRAO = "#047857";

export const LOGO_MAX_BYTES = 200 * 1024;

const ASSINATURAS: { mime: string; bytes: number[] }[] = [
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF (+ "WEBP" no byte 8)
];

/** Data URL de imagem válida e pequena → a mesma string; senão null. */
export function logoValido(dataUrl: string): string | null {
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+=*)$/.exec(dataUrl);
  if (!m) return null;
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length === 0 || bytes.length > LOGO_MAX_BYTES) return null;
  const assinatura = ASSINATURAS.find((a) => a.mime === m[1]);
  if (!assinatura || !assinatura.bytes.every((b, i) => bytes[i] === b)) return null;
  if (m[1] === "image/webp" && bytes.subarray(8, 12).toString("ascii") !== "WEBP") return null;
  return dataUrl;
}

const textoCurto = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => s || null)
    .nullable()
    .optional();

export const esquemaMarca = z.object({
  nome: textoCurto(80),
  cor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor no formato #RRGGBB.")
    .nullable()
    .optional(),
  logo: z
    .string()
    .max(Math.ceil((LOGO_MAX_BYTES * 4) / 3) + 64, "Logo grande demais (máx. 200 KB).")
    .nullable()
    .optional(),
  responsavel: textoCurto(120),
  contato: textoCurto(160),
});

export async function lerMarca(usuarioId: number): Promise<Marca> {
  const l = await buscarUm<Marca>(
    "SELECT nome, cor, logo, responsavel, contato FROM marcas WHERE usuario_id = ?",
    usuarioId,
  );
  return l ? { ...MARCA_VAZIA, ...l } : { ...MARCA_VAZIA };
}

export async function salvarMarca(usuarioId: number, m: Marca): Promise<void> {
  await executar(
    `INSERT INTO marcas (usuario_id, nome, cor, logo, responsavel, contato)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (usuario_id) DO UPDATE SET
       nome = excluded.nome, cor = excluded.cor, logo = excluded.logo,
       responsavel = excluded.responsavel, contato = excluded.contato,
       atualizado_em = CURRENT_TIMESTAMP`,
    usuarioId,
    m.nome,
    m.cor,
    m.logo,
    m.responsavel,
    m.contato,
  );
}

/**
 * Cor legível como texto sobre papel branco: cores claras demais (amarelo,
 * verde-limão) escurecem até contraste ≥ 4,5:1.
 */
export function corLegivel(hex: string | null | undefined): string {
  const base = /^#[0-9a-fA-F]{6}$/.test(hex ?? "") ? (hex as string) : COR_PADRAO;
  let [r, g, b] = [1, 3, 5].map((i) => parseInt(base.slice(i, i + 2), 16));
  const lum = () =>
    [r, g, b]
      .map((c) => c / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
  for (let i = 0; i < 20 && 1.05 / (lum() + 0.05) < 4.5; i++) {
    [r, g, b] = [r, g, b].map((c) => Math.round(c * 0.85));
  }
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

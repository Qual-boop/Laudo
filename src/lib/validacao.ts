import { z } from "zod";
import { normalizarConfianca } from "@/lib/verificacao";

/**
 * Validação de entrada da API v1 (Zod).
 *
 * Todo payload de escrita passa por aqui antes de tocar o banco ou a IA.
 * Erros saem no formato { error, code: "VALIDACAO", detalhes }.
 */

const SEVERIDADES = ["Critica", "Alta", "Media", "Baixa"] as const;
const RESULTADOS = ["corrigido", "nao-corrigido", "parcial"] as const;

/** Texto livre com teto anti-abuso (custo de IA / tamanho do banco). */
const texto = (maximo = 20000) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v : ""),
    z.string().max(maximo),
  );

const severidade = z
  .preprocess((v) => (typeof v === "string" ? v : "Media"), z.string())
  .pipe(z.enum(SEVERIDADES).catch("Media"));

const confianca = z
  .preprocess((v) => normalizarConfianca(v), z.string())
  .pipe(z.enum(["Alta", "Media", "Baixa"]).catch("Media"));

/* ---------- Auth ---------- */

/**
 * Senhas que caem nos primeiros segundos de qualquer ataque de dicionário
 * (listas públicas de vazamentos, versões em português incluídas).
 */
const SENHAS_COMUNS = new Set([
  "12345678", "123456789", "1234567890", "87654321", "11111111", "00000000",
  "password", "password1", "password123", "senha123", "senha1234", "minhasenha",
  "qwertyui", "qwerty123", "asdfghjk", "abcd1234", "abc12345", "iloveyou",
  "admin123", "administrador", "welcome1", "letmein1", "11223344", "12341234",
  "brasil123", "flamengo", "corinthians", "palmeiras", "pentest123", "provafix",
  "123mudar", "mudar123", "trocar123", "changeme", "p@ssw0rd", "passw0rd",
]);

/** Fraca demais: lista de vazamentos ou um caractere só repetido. */
export function senhaFraca(senha: string): boolean {
  const s = senha.toLowerCase();
  return SENHAS_COMUNS.has(s) || /^(.)\1+$/.test(s);
}

export const esquemaSenhaNova = z
  .string()
  .min(8, "Senha deve ter ao menos 8 caracteres.")
  .max(128, "Senha deve ter no máximo 128 caracteres.")
  .refine((s) => !senhaFraca(s), "Senha muito comum — escolha outra (uma frase curta funciona bem).");

export const esquemaCadastro = z
  .object({
    nome: z.string().trim().min(1, "Nome é obrigatório.").max(120),
    email: z.string().trim().toLowerCase().email("E-mail inválido.").max(254),
    senha: esquemaSenhaNova,
  })
  .refine((d) => d.senha.toLowerCase() !== d.email, {
    message: "A senha não pode ser o seu e-mail.",
    path: ["senha"],
  });

export const esquemaLogin = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(254),
  senha: z.string().min(1, "Senha é obrigatória.").max(128),
});

const esquemaEmail = z.string().trim().toLowerCase().email("E-mail inválido.").max(254);
const esquemaCodigo6 = z
  .string()
  .transform((s) => s.replace(/\D/g, ""))
  .refine((s) => s.length === 6, "O código tem 6 dígitos.");

/** 2ª etapa do login: senha de novo + código recebido por e-mail. */
export const esquemaConfirmarLogin = z.object({
  email: esquemaEmail,
  senha: z.string().min(1, "Senha é obrigatória.").max(128),
  codigo: esquemaCodigo6,
});

/** Troca o ticket (senha + código já conferidos) pela sessão. */
export const esquemaTicket = z.object({
  email: esquemaEmail,
  ticket: z.string().regex(/^[0-9a-f]{64}$/i, "Ticket inválido."),
});

export const esquemaSolicitarSenha = z.object({ email: esquemaEmail });

export const esquemaRedefinirSenha = z.object({
  email: esquemaEmail,
  codigo: esquemaCodigo6,
  senha: esquemaSenhaNova,
});

/* ---------- POST /api/v1/gerar ---------- */

const esquemaAchadoEntrada = z.preprocess(
  (v) => (v !== null && typeof v === "object" && !Array.isArray(v) ? v : {}),
  z.object({
    titulo: texto(500),
    severidade,
    cwe: texto(20),
    descricao: texto(),
    evidencia: texto(),
    confianca,
    dataRetesteSugerida: texto(10),
  }),
);

export const esquemaGerar = z.object({
  cliente: texto(200),
  titulo: texto(200),
  escopo: texto(),
  periodo: texto(100),
  limitacoes: texto(),
  ferramentas: texto(500),
  achados: z
    .preprocess(
      (v) => (Array.isArray(v) ? v : []),
      z.array(esquemaAchadoEntrada).max(50, "Máximo de 50 achados por relatório."),
    )
    .refine((a) => a.length > 0, {
      message: "Informe ao menos um achado para gerar o relatório.",
    })
    .refine((a) => a.some((x) => x.titulo.trim() || x.descricao.trim()), {
      message: "Cada achado precisa de ao menos um título ou descrição.",
    }),
});

export type EntradaGerar = z.infer<typeof esquemaGerar>;

/* ---------- POST /api/v1/relatorios ---------- */

export const esquemaSalvarRelatorio = z.object({
  capa: z.object({
    cliente: texto(200),
    titulo: texto(200),
    data: texto(10),
    versao: texto(20),
  }),
  sumarioExecutivo: z
    .object({ riscoGeral: texto(20) })
    .partial()
    .optional(),
  achados: z
    .array(
      z.preprocess(
        (v) => (v !== null && typeof v === "object" ? v : {}),
        z.object({
          id: texto(30),
          titulo: texto(500),
          severidade,
          cwe: texto(20),
          confianca,
          dataRetesteSugerida: texto(10),
        }).partial(),
      ),
    )
    .min(1, "Relatório precisa de ao menos um achado.")
    .max(50, "Máximo de 50 achados por relatório."),
});

/* ---------- /api/v1/verificacao ---------- */

export const esquemaReteste = z.object({
  achadoId: z
    .preprocess((v) => Number(v), z.number())
    .pipe(
      z
        .number()
        .int("achadoId é obrigatório e deve ser um número inteiro."),
    ),
  resultado: z.enum(RESULTADOS, {
    message: `resultado inválido. Use: ${RESULTADOS.join(", ")}.`,
  }),
  evidencia: z
    .preprocess(
      (v) => (typeof v === "string" ? v.trim() : ""),
      z.string().min(1, "Registre a evidência do reteste — é ela que comprova a correção."),
    )
    .pipe(z.string().max(20000)),
  dataReteste: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().max(10),
  ),
});

export const esquemaPaginacao = z.object({
  limit: z
    .preprocess(
      (v) => {
        const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN;
        return Number.isFinite(n) ? Math.trunc(n) : 50;
      },
      z.number().int().min(1).max(200).catch(50),
    ),
  page: z
    .preprocess(
      (v) => {
        const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN;
        return Number.isFinite(n) ? Math.trunc(n) : 1;
      },
      z.number().int().min(1).catch(1),
    ),
});

export const esquemaId = z
  .preprocess((v) => Number(v), z.number())
  .pipe(z.number().int().positive("ID inválido."));

export const esquemaAchadoIdQuery = z
  .preprocess((v) => (v === null || v === undefined ? undefined : Number(v)), z.number().optional())
  .pipe(z.number().int().optional());

/* ---------- Formato de erro ---------- */

export type ErroValidacao = {
  error: string;
  code: "VALIDACAO";
  detalhes: { campo: string; mensagem: string }[];
};

export function formatarErroZod(e: z.ZodError): ErroValidacao {
  const detalhes = e.issues.map((i) => ({
    campo: i.path.join(".") || "(corpo)",
    mensagem: i.message,
  }));
  return {
    error: detalhes[0]?.mensagem ?? "Entrada inválida.",
    code: "VALIDACAO",
    detalhes,
  };
}

/** Helper: valida e devolve { ok, dados } ou { ok:false, resposta } pronta. */
export function validar<T extends z.ZodType>(
  esquema: T,
  bruto: unknown,
): { ok: true; dados: z.infer<T> } | { ok: false; resposta: Response } {
  const r = esquema.safeParse(bruto);
  if (r.success) return { ok: true, dados: r.data };
  return {
    ok: false,
    resposta: Response.json(formatarErroZod(r.error), { status: 400 }),
  };
}

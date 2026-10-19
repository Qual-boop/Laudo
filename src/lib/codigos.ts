import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { buscarUm, executar, inserir } from "@/lib/banco";

/**
 * Códigos de uso único (tabela `codigos_email`).
 *
 *   login  → 6 dígitos por e-mail, 2ª etapa do login
 *   senha  → 6 dígitos por e-mail, troca de senha esquecida
 *   ticket → 64 hex, entregue ao navegador depois de senha + código
 *            certos; o NextAuth troca o ticket pela sessão (2 min, 1 uso)
 *
 * Só o HMAC (chave = AUTH_SECRET) fica no banco: quem ler o banco não
 * consegue nem testar os 10⁶ códigos offline sem o segredo do servidor.
 * Errou 5 vezes → o código queima e é preciso pedir outro.
 */

export type Finalidade = "login" | "senha" | "ticket";

export const VALIDADE_MIN: Record<Finalidade, number> = { login: 10, senha: 15, ticket: 2 };
export const MAX_TENTATIVAS = 5;
/** Intervalo mínimo entre dois envios para o mesmo usuário/finalidade. */
export const REENVIO_SEG = 45;

function hmac(usuarioId: number, finalidade: Finalidade, codigo: string): string {
  const segredo = process.env.AUTH_SECRET;
  if (!segredo) throw new Error("AUTH_SECRET ausente: códigos indisponíveis.");
  return createHmac("sha256", segredo)
    .update(`${usuarioId}:${finalidade}:${codigo}`)
    .digest("hex");
}

function iguais(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

type Linha = {
  id: number;
  codigo_hash: string;
  expira_em: string;
  tentativas: number;
  criado_em: string;
};

async function ultimo(usuarioId: number, finalidade: Finalidade): Promise<Linha | undefined> {
  return buscarUm<Linha>(
    `SELECT id, codigo_hash, expira_em, tentativas, criado_em FROM codigos_email
     WHERE usuario_id = ? AND finalidade = ? AND usado_em IS NULL
     ORDER BY id DESC LIMIT 1`,
    usuarioId,
    finalidade,
  );
}

export type Emissao = { codigo: string } | { aguardeSeg: number };

/**
 * Gera um código novo (invalida os anteriores da mesma finalidade).
 * Pedido de novo antes de REENVIO_SEG → devolve quanto falta esperar.
 */
export async function emitirCodigo(
  usuarioId: number,
  finalidade: Finalidade,
  agora = Date.now(),
): Promise<Emissao> {
  if (finalidade !== "ticket") {
    const anterior = await ultimo(usuarioId, finalidade);
    if (anterior) {
      const passou = (agora - new Date(anterior.criado_em).getTime()) / 1000;
      if (passou < REENVIO_SEG) return { aguardeSeg: Math.ceil(REENVIO_SEG - passou) };
    }
  }

  const codigo =
    finalidade === "ticket"
      ? randomBytes(32).toString("hex")
      : String(randomInt(0, 1_000_000)).padStart(6, "0");

  await executar(
    "DELETE FROM codigos_email WHERE usuario_id = ? AND finalidade = ?",
    usuarioId,
    finalidade,
  );
  await inserir(
    `INSERT INTO codigos_email (usuario_id, finalidade, codigo_hash, expira_em, criado_em)
     VALUES (?, ?, ?, ?, ?)`,
    usuarioId,
    finalidade,
    hmac(usuarioId, finalidade, codigo),
    new Date(agora + VALIDADE_MIN[finalidade] * 60_000).toISOString(),
    new Date(agora).toISOString(),
  );
  return { codigo };
}

export type Conferencia =
  | { ok: true }
  | { ok: false; motivo: "invalido"; restantes: number }
  | { ok: false; motivo: "expirado" | "bloqueado" };

/** Confere e consome. Errado conta tentativa; certo marca como usado. */
export async function conferirCodigo(
  usuarioId: number,
  finalidade: Finalidade,
  codigo: string,
  agora = Date.now(),
): Promise<Conferencia> {
  const linha = await ultimo(usuarioId, finalidade);
  if (!linha || new Date(linha.expira_em).getTime() < agora) {
    return { ok: false, motivo: "expirado" };
  }
  const maximo = finalidade === "ticket" ? 1 : MAX_TENTATIVAS;
  if (linha.tentativas >= maximo) return { ok: false, motivo: "bloqueado" };

  const limpo = finalidade === "ticket" ? codigo.trim().toLowerCase() : codigo.replace(/\D/g, "");
  if (!iguais(hmac(usuarioId, finalidade, limpo), linha.codigo_hash)) {
    await executar(
      "UPDATE codigos_email SET tentativas = tentativas + 1 WHERE id = ?",
      linha.id,
    );
    const restantes = maximo - (linha.tentativas + 1);
    return restantes > 0
      ? { ok: false, motivo: "invalido", restantes }
      : { ok: false, motivo: "bloqueado" };
  }

  // Consumo atômico: duas conferências simultâneas do mesmo código não
  // passam as duas.
  const usados = await executar(
    "UPDATE codigos_email SET usado_em = ? WHERE id = ? AND usado_em IS NULL",
    new Date(agora).toISOString(),
    linha.id,
  );
  if (usados === 0) return { ok: false, motivo: "expirado" };

  if (finalidade !== "ticket") {
    // Recebeu o código no e-mail = e-mail comprovado.
    await executar(
      "UPDATE usuarios SET email_verificado_em = ? WHERE id = ? AND email_verificado_em IS NULL",
      new Date(agora).toISOString(),
      usuarioId,
    );
  }
  return { ok: true };
}

/** Mensagem para o usuário a partir do motivo da recusa. */
export function mensagemConferencia(c: Exclude<Conferencia, { ok: true }>): string {
  if (c.motivo === "invalido") {
    return `Código incorreto. ${c.restantes === 1 ? "Resta 1 tentativa" : `Restam ${c.restantes} tentativas`}.`;
  }
  if (c.motivo === "bloqueado") return "Tentativas esgotadas para este código. Peça um novo.";
  return "Código expirado. Peça um novo.";
}

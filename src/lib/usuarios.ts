import bcrypt from "bcryptjs";
import db from "@/lib/db";

export type Usuario = {
  id: number;
  nome: string;
  email: string;
  senha_hash: string | null;
  plano: string;
  plano_expira_em: string | null;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  assinatura_status: string | null;
  assinatura_ciclo: string | null;
  criado_em: string;
  atualizado_em: string;
};

/** Custo do bcrypt: 12 em produção, mínimo nos testes (via env). */
function custoBcrypt(): number {
  const n = Number(process.env.BCRYPT_ROUNDS);
  if (Number.isInteger(n) && n >= 4 && n <= 14) return n;
  return 12;
}

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, custoBcrypt());
}

export async function compararSenha(
  senha: string,
  hash: string,
): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(senha, hash);
}

export function buscarUsuarioPorEmail(email: string): Usuario | null {
  const linha = db
    .prepare("SELECT * FROM usuarios WHERE email = ?")
    .get(email.trim().toLowerCase()) as Usuario | undefined;
  return linha ?? null;
}

export function buscarUsuarioPorId(id: number): Usuario | null {
  const linha = db
    .prepare("SELECT * FROM usuarios WHERE id = ?")
    .get(id) as Usuario | undefined;
  return linha ?? null;
}

/** Troca o plano (checkout, webhook, admin). Retorna false se inválido. */
export function definirPlano(id: number, plano: string): boolean {
  if (plano !== "free" && plano !== "pro" && plano !== "team") return false;
  const info = db
    .prepare(
      "UPDATE usuarios SET plano = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?",
    )
    .run(plano, id);
  return info.changes > 0;
}

/** Cria usuário com senha (cadastro). Retorna null se o e-mail já existe. */
export async function criarUsuario(
  nome: string,
  email: string,
  senha: string,
): Promise<Usuario | null> {
  const emailNormalizado = email.trim().toLowerCase();
  if (buscarUsuarioPorEmail(emailNormalizado)) return null;

  const senha_hash = await hashSenha(senha);
  const info = db
    .prepare("INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)")
    .run(nome.trim(), emailNormalizado, senha_hash);

  return buscarUsuarioPorId(Number(info.lastInsertRowid));
}

/**
 * Garante uma linha para login OAuth (Google): cria sem senha se não
 * existir, nunca sobrescreve nome/senha de conta existente.
 */
export function buscarOuCriarPorEmail(
  email: string,
  nome: string,
): Usuario | null {
  const existente = buscarUsuarioPorEmail(email);
  if (existente) return existente;

  const info = db
    .prepare("INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, NULL)")
    .run(nome.trim() || email, email.trim().toLowerCase());

  return buscarUsuarioPorId(Number(info.lastInsertRowid));
}

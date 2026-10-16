import bcrypt from "bcryptjs";
import { buscarUm, executar, inserir } from "@/lib/banco";

export type Usuario = {
  id: number;
  nome: string;
  email: string;
  senha_hash: string | null;
  plano: string;
  plano_expira_em: string | null;
  trial_usado_em: string | null;
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

export async function buscarUsuarioPorEmail(
  email: string,
): Promise<Usuario | null> {
  const linha = await buscarUm<Usuario>(
    "SELECT * FROM usuarios WHERE email = ?",
    email.trim().toLowerCase(),
  );
  return linha ?? null;
}

export async function buscarUsuarioPorId(id: number): Promise<Usuario | null> {
  const linha = await buscarUm<Usuario>(
    "SELECT * FROM usuarios WHERE id = ?",
    id,
  );
  return linha ?? null;
}

/** Troca o plano (checkout, webhook, admin). Retorna false se inválido. */
export async function definirPlano(id: number, plano: string): Promise<boolean> {
  if (plano !== "free" && plano !== "pro" && plano !== "team") return false;
  const alterados = await executar(
    "UPDATE usuarios SET plano = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?",
    plano,
    id,
  );
  return alterados > 0;
}

/** Cria usuário com senha (cadastro). Retorna null se o e-mail já existe. */
export async function criarUsuario(
  nome: string,
  email: string,
  senha: string,
): Promise<Usuario | null> {
  const emailNormalizado = email.trim().toLowerCase();
  if (await buscarUsuarioPorEmail(emailNormalizado)) return null;

  const senha_hash = await hashSenha(senha);
  const id = await inserir(
    "INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)",
    nome.trim(),
    emailNormalizado,
    senha_hash,
  );

  return buscarUsuarioPorId(id);
}

/**
 * Garante uma linha para login OAuth (Google): cria sem senha se não
 * existir, nunca sobrescreve nome/senha de conta existente.
 */
export async function buscarOuCriarPorEmail(
  email: string,
  nome: string,
): Promise<Usuario | null> {
  const existente = await buscarUsuarioPorEmail(email);
  if (existente) return existente;

  const id = await inserir(
    "INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, NULL)",
    nome.trim() || email,
    email.trim().toLowerCase(),
  );

  return buscarUsuarioPorId(id);
}

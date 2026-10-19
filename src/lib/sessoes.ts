import { randomUUID } from "node:crypto";
import { buscarUm, executar, inserir } from "@/lib/banco";

/**
 * Sessões revogáveis (web e Bearer) na tabela `sessoes`.
 *
 * Todo JWT emitido carrega `sid` = id da linha. Sem a linha (logout, "sair
 * de todos", troca de senha) o token deixa de valer na hora, mesmo que um
 * cópia dele continue por aí — antes o JWT web valia 30 dias de qualquer
 * jeito, e "sair" só apagava o cookie deste navegador.
 */

/** Validade da sessão (igual ao maxAge do JWT: 30 dias). */
export const SESSAO_MAX_AGE_SEG = 30 * 24 * 60 * 60;

/** Cria a linha da sessão e devolve o `sid` que vai no JWT. */
export async function criarSessao(
  usuarioId: number,
  tokenHash = `web:${randomUUID()}`,
): Promise<number> {
  // Higiene oportunista: sessões vencidas deste usuário saem da tabela.
  await executar(
    "DELETE FROM sessoes WHERE usuario_id = ? AND expira_em < ?",
    usuarioId,
    new Date().toISOString(),
  );
  return inserir(
    "INSERT INTO sessoes (usuario_id, token_hash, expira_em) VALUES (?, ?, ?)",
    usuarioId,
    tokenHash,
    new Date(Date.now() + SESSAO_MAX_AGE_SEG * 1000).toISOString(),
  );
}

/** A sessão existe, é deste usuário e não venceu. */
export async function sessaoValida(sid: unknown, usuarioId: number): Promise<boolean> {
  const id = Number(sid);
  if (!Number.isInteger(id) || id <= 0) return false;
  const s = await buscarUm<{ usuario_id: number; expira_em: string }>(
    "SELECT usuario_id, expira_em FROM sessoes WHERE id = ?",
    id,
  );
  return (
    !!s &&
    Number(s.usuario_id) === usuarioId &&
    new Date(s.expira_em).getTime() > Date.now()
  );
}

export async function revogarSessao(sid: unknown): Promise<void> {
  const id = Number(sid);
  if (Number.isInteger(id) && id > 0) {
    await executar("DELETE FROM sessoes WHERE id = ?", id);
  }
}

/** "Sair de todos os dispositivos" e troca de senha. */
export async function revogarTodas(usuarioId: number): Promise<number> {
  return executar("DELETE FROM sessoes WHERE usuario_id = ?", usuarioId);
}

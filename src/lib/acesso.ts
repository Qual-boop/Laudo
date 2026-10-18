import { buscarUm } from "@/lib/banco";
import type { Plano } from "@/lib/planos";

/**
 * Quem pode o quê num relatório.
 *   dono    — quem salvou; tudo.
 *   revisor — colega com quem o dono compartilhou; lê, comenta e vê
 *             evidências. Não altera status, não compartilha, não apaga.
 * Fail-closed: relatório sem dono (legado) não abre para ninguém.
 */
export type Papel = "dono" | "revisor";

export async function papelNoRelatorio(usuarioId: number, relatorioId: number): Promise<Papel | null> {
  const r = await buscarUm<{ usuario_id: number | null; papel: string | null }>(
    `SELECT r.usuario_id, c.papel
       FROM relatorios r
       LEFT JOIN compartilhamentos c ON c.relatorio_id = r.id AND c.usuario_id = ?
      WHERE r.id = ?`,
    usuarioId,
    relatorioId,
  );
  if (!r || r.usuario_id === null) return null;
  if (Number(r.usuario_id) === usuarioId) return "dono";
  return r.papel ? "revisor" : null;
}

export async function papelNoAchado(
  usuarioId: number,
  achadoId: number,
): Promise<{ papel: Papel; relatorioId: number } | null> {
  const a = await buscarUm<{ relatorio_id: number | null }>(
    "SELECT relatorio_id FROM achados_verificacao WHERE id = ?",
    achadoId,
  );
  if (!a?.relatorio_id) return null;
  const relatorioId = Number(a.relatorio_id);
  const papel = await papelNoRelatorio(usuarioId, relatorioId);
  return papel ? { papel, relatorioId } : null;
}

/** Colegas por relatório: Pro revisa em dupla; Team, em equipe. */
export const LIMITE_COLEGAS: Record<Plano, number> = { free: 0, pro: 1, team: 10 };

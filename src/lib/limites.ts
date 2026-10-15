import db from "@/lib/db";
import { LIMITES, type Plano } from "@/lib/planos";

export { LIMITES, normalizarPlano } from "@/lib/planos";
export type { LimitesPlano, Plano } from "@/lib/planos";

/** "2026-10" — chave do uso mensal (mês novo = linha nova = reset automático). */
export function mesAtual(data = new Date()): string {
  return data.toISOString().slice(0, 7);
}

export type UsoMensal = {
  relatorios_criados: number;
  retestes_registrados: number;
};

export function obterUso(usuarioId: number, mes = mesAtual()): UsoMensal {
  db.prepare(
    `INSERT INTO uso_mensal (usuario_id, mes_ano) VALUES (?, ?)
     ON CONFLICT (usuario_id, mes_ano) DO NOTHING`,
  ).run(usuarioId, mes);
  return lerUso(usuarioId, mes);
}

/** Leitura sem escrita (não cria a linha): para checagens que não consomem. */
export function lerUso(usuarioId: number, mes = mesAtual()): UsoMensal {
  const linha = db
    .prepare(
      "SELECT relatorios_criados, retestes_registrados FROM uso_mensal WHERE usuario_id = ? AND mes_ano = ?",
    )
    .get(usuarioId, mes) as UsoMensal | undefined;
  return linha ?? { relatorios_criados: 0, retestes_registrados: 0 };
}

export function incrementarUso(
  usuarioId: number,
  campo: "relatorios_criados" | "retestes_registrados",
  mes = mesAtual(),
): void {
  obterUso(usuarioId, mes); // garante a linha
  db.prepare(
    `UPDATE uso_mensal SET ${campo} = ${campo} + 1 WHERE usuario_id = ? AND mes_ano = ?`,
  ).run(usuarioId, mes);
}

export type RecursoLimitado = "relatorios" | "retestes";

export type VereditoLimite = {
  permitido: boolean;
  usados: number;
  limite: number;
  recurso: RecursoLimitado;
};

/** Verifica antes de permitir a ação (chamar incrementarUso depois). */
export function verificarLimite(
  plano: Plano,
  uso: UsoMensal,
  recurso: RecursoLimitado,
): VereditoLimite {
  const limites = LIMITES[plano];
  const campo = recurso === "relatorios" ? "relatorios_criados" : "retestes_registrados";
  const limite = recurso === "relatorios" ? limites.relatoriosMes : limites.retestesMes;
  const usados = uso[campo];
  return { permitido: usados < limite, usados, limite, recurso };
}

/** Limpa linhas de meses passados (higiene; o reset é automático por mes_ano). */
export function resetarUsoMensal(mes = mesAtual()): number {
  const info = db.prepare("DELETE FROM uso_mensal WHERE mes_ano <> ?").run(mes);
  return Number(info.changes);
}

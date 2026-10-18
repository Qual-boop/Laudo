import { diaBase, situacaoPrazo } from "@/lib/prazos";
import type { AchadoVerificavel, Severidade } from "@/lib/tipos";

/**
 * Métricas de remediação para a reunião de acompanhamento: quanto já foi
 * corrigido, em quanto tempo e o que está estourando prazo.
 */
export type MetricasRemediacao = {
  total: number;
  verificados: number;
  abertos: number;
  /** 0–100, arredondado. */
  taxaCorrecao: number;
  /** Média de dias entre a entrega e o reteste que confirmou a correção. */
  tempoMedioCorrecaoDias: number | null;
  atrasados: number;
  venceLogo: number;
  abertosPorSeveridade: Record<Severidade, number>;
};

const DIA = 86_400_000;

export function estaAtrasado(a: AchadoVerificavel, hoje: Date = new Date()): boolean {
  if (a.status === "verificado") return false;
  return situacaoPrazo(a.severidade, a.criado_em, hoje)?.estado === "atrasado";
}

export function calcularMetricas(
  achados: AchadoVerificavel[],
  hoje: Date = new Date(),
): MetricasRemediacao {
  const abertosPorSeveridade: Record<Severidade, number> = { Critica: 0, Alta: 0, Media: 0, Baixa: 0 };
  let verificados = 0;
  let atrasados = 0;
  let venceLogo = 0;
  const tempos: number[] = [];

  for (const a of achados) {
    if (a.status === "verificado") {
      verificados++;
      const entrega = diaBase(a.criado_em);
      const reteste = a.ultimo_reteste ? diaBase(a.ultimo_reteste.data_reteste) : null;
      if (entrega !== null && reteste !== null) {
        tempos.push(Math.max(0, Math.round((reteste - entrega) / DIA)));
      }
      continue;
    }
    abertosPorSeveridade[a.severidade] = (abertosPorSeveridade[a.severidade] ?? 0) + 1;
    const prazo = situacaoPrazo(a.severidade, a.criado_em, hoje);
    if (prazo?.estado === "atrasado") atrasados++;
    else if (prazo?.estado === "vence-logo") venceLogo++;
  }

  const total = achados.length;
  return {
    total,
    verificados,
    abertos: total - verificados,
    taxaCorrecao: total === 0 ? 0 : Math.round((verificados / total) * 100),
    tempoMedioCorrecaoDias: tempos.length
      ? Math.round((tempos.reduce((s, t) => s + t, 0) / tempos.length) * 10) / 10
      : null,
    atrasados,
    venceLogo,
    abertosPorSeveridade,
  };
}

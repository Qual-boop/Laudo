import type { Severidade } from "@/lib/tipos";

/**
 * Prazos de correção por severidade, contados a partir da entrega do
 * achado (quando o relatório foi salvo). São referências de mercado para
 * SLA de remediação — não substituem o prazo acordado com o cliente.
 */
export const PRAZO_DIAS: Record<Severidade, number> = {
  Critica: 7,
  Alta: 30,
  Media: 90,
  Baixa: 180,
};

export type EstadoPrazo = "no-prazo" | "vence-logo" | "atrasado";

export type SituacaoPrazo = {
  /** YYYY-MM-DD */
  venceEm: string;
  /** Dias até o vencimento; negativo = dias de atraso. */
  dias: number;
  estado: EstadoPrazo;
};

const DIA = 86_400_000;

/**
 * Dia (meia-noite UTC do dia local) da entrega. Data pura ("2026-10-07")
 * vale como está. Com hora, é um instante gravado pelo banco em UTC — o
 * CURRENT_TIMESTAMP do SQLite não traz fuso — e vira o dia local de quem
 * vê: às 22h em Brasília já é o dia seguinte em UTC.
 */
function diaBase(iso: string): number | null {
  const m = iso.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?)?/,
  );
  if (!m) return null;
  if (m[4] === undefined) {
    const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(t) ? null : t;
  }
  const fuso = !m[7] || m[7] === "Z" ? "Z" : m[7].includes(":") ? m[7] : `${m[7].slice(0, 3)}:${m[7].slice(3)}`;
  const instante = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? "00"}${fuso}`);
  if (Number.isNaN(instante.getTime())) return null;
  return Date.UTC(instante.getFullYear(), instante.getMonth(), instante.getDate());
}

export function situacaoPrazo(
  severidade: Severidade,
  entregueEm: string,
  hoje: Date = new Date(),
): SituacaoPrazo | null {
  const base = diaBase(entregueEm ?? "");
  if (base === null) return null;
  const prazo = PRAZO_DIAS[severidade] ?? PRAZO_DIAS.Media;
  const vence = base + prazo * DIA;
  const hojeUTC = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const dias = Math.round((vence - hojeUTC) / DIA);
  const alerta = Math.min(7, Math.ceil(prazo / 4));
  return {
    venceEm: new Date(vence).toISOString().slice(0, 10),
    dias,
    estado: dias < 0 ? "atrasado" : dias <= alerta ? "vence-logo" : "no-prazo",
  };
}

export function rotuloPrazo(s: SituacaoPrazo): string {
  if (s.dias < 0) return s.dias === -1 ? "atrasado há 1 dia" : `atrasado há ${-s.dias} dias`;
  if (s.dias === 0) return "vence hoje";
  return s.dias === 1 ? "vence amanhã" : `vence em ${s.dias} dias`;
}

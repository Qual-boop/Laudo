import { PRAZO_DIAS, situacaoPrazo } from "@/lib/prazos";
import type { AchadoVerificavel } from "@/lib/tipos";

/**
 * Agenda de retestes em iCalendar (RFC 5545). Funciona em Google Agenda,
 * Outlook e Apple Calendário sem nenhum serviço de e-mail: o lembrete é o
 * alarme do próprio calendário (VALARM), um dia antes.
 */

export type EventoAgenda = {
  uid: string;
  data: string; // YYYY-MM-DD (evento de dia inteiro)
  titulo: string;
  descricao: string;
};

const SEV: Record<AchadoVerificavel["severidade"], string> = {
  Critica: "crítica",
  Alta: "alta",
  Media: "média",
  Baixa: "baixa",
};

/** Eventos dos achados em aberto: reteste sugerido e vencimento do prazo. */
export function eventosDaAgenda(achados: AchadoVerificavel[], hoje: Date = new Date()): EventoAgenda[] {
  const eventos: EventoAgenda[] = [];
  for (const a of achados) {
    if (a.status === "verificado") continue;
    const rotulo = `${a.achado_ref} · ${a.titulo}`;
    if (a.data_reteste_sugerida && /^\d{4}-\d{2}-\d{2}$/.test(a.data_reteste_sugerida)) {
      eventos.push({
        uid: `laudo-reteste-${a.id}@laudo`,
        data: a.data_reteste_sugerida,
        titulo: `Reteste: ${rotulo}`,
        descricao: `Cliente: ${a.cliente}. Severidade ${SEV[a.severidade]}. Registre o resultado no Provafix para atualizar o status e o certificado.`,
      });
    }
    const prazo = situacaoPrazo(a.severidade, a.criado_em, hoje);
    if (prazo) {
      eventos.push({
        uid: `laudo-prazo-${a.id}@laudo`,
        data: prazo.venceEm,
        titulo: `Prazo de correção: ${rotulo}`,
        descricao: `Cliente: ${a.cliente}. Prazo de referência para severidade ${SEV[a.severidade]}: ${PRAZO_DIAS[a.severidade]} dias a partir da entrega.${
          prazo.estado === "atrasado" ? " ATENÇÃO: já vencido." : ""
        }`,
      });
    }
  }
  return eventos.sort((x, y) => x.data.localeCompare(y.data));
}

/** Escapa texto conforme RFC 5545 §3.3.11. */
export function escaparIcs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Dobra linhas em 75 octetos (RFC 5545 §3.1), sem quebrar caractere UTF-8. */
export function dobrarLinha(linha: string): string {
  const bytes = new TextEncoder();
  if (bytes.encode(linha).length <= 75) return linha;
  const partes: string[] = [];
  let atual = "";
  let tamanho = 0;
  for (const ch of linha) {
    const n = bytes.encode(ch).length;
    const limite = partes.length === 0 ? 75 : 74; // continuação começa com espaço
    if (tamanho + n > limite) {
      partes.push(atual);
      atual = "";
      tamanho = 0;
    }
    atual += ch;
    tamanho += n;
  }
  partes.push(atual);
  return partes.join("\r\n ");
}

function dataIcs(iso: string): string {
  return iso.replace(/-/g, "");
}

function diaSeguinte(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
}

function carimbo(agora: Date): string {
  return agora.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function gerarIcs(eventos: EventoAgenda[], agora: Date = new Date()): string {
  const linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Provafix//Agenda de retestes//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Provafix — retestes e prazos",
  ];
  for (const e of eventos) {
    linhas.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${carimbo(agora)}`,
      `DTSTART;VALUE=DATE:${dataIcs(e.data)}`,
      `DTEND;VALUE=DATE:${dataIcs(diaSeguinte(e.data))}`,
      `SUMMARY:${escaparIcs(e.titulo)}`,
      `DESCRIPTION:${escaparIcs(e.descricao)}`,
      "TRANSP:TRANSPARENT",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escaparIcs(e.titulo)}`,
      "TRIGGER:-P1D",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  linhas.push("END:VCALENDAR");
  return `${linhas.map(dobrarLinha).join("\r\n")}\r\n`;
}

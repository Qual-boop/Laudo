import type { Documento } from "@/lib/documento";
import { ROTULO_SEVERIDADE } from "@/lib/documento";
import { ROTULO_RESULTADO, ROTULO_STATUS, cvssTexto, dataBr } from "@/lib/documento-formato";
import { PRAZO_DIAS, rotuloPrazo } from "@/lib/prazos";

/**
 * Planilha de acompanhamento dos achados (CSV para Excel/Planilhas).
 *
 * Formato pt-BR: separador ";" e BOM UTF-8 — o Excel em português abre
 * com acentos e colunas certas no duplo clique. Célula que começa com
 * = + - @ (ou tab/CR) ganha um apóstrofo na frente: sem isso, um achado
 * com "=HYPERLINK(...)" no título vira fórmula na máquina do cliente
 * (CSV/formula injection, CWE-1236).
 */

export function celula(valor: unknown): string {
  let s = valor == null ? "" : String(valor);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[";\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function linhaCsv(valores: unknown[]): string {
  return valores.map(celula).join(";");
}

export const CABECALHO_CSV = [
  "ID",
  "Título",
  "Severidade",
  "CVSS",
  "Vetor CVSS",
  "CWE",
  "OWASP",
  "Situação",
  "Último reteste",
  "Resultado do reteste",
  "Prazo (dias)",
  "Vence em",
  "Prazo",
  "Correção de curto prazo",
  "Correção definitiva",
];

export function gerarCsv(doc: Documento): string {
  const linhas = [linhaCsv(CABECALHO_CSV)];
  for (const a of doc.achados) {
    const r = a.verificacao?.ultimoReteste;
    linhas.push(
      linhaCsv([
        a.id,
        a.titulo,
        ROTULO_SEVERIDADE[a.severidade],
        cvssTexto(a.cvss.score).replace(".", ","),
        a.cvss.vetor,
        a.cwe,
        a.owasp,
        ROTULO_STATUS[a.verificacao?.status ?? "pendente"],
        r ? dataBr(r.data) : "",
        r ? ROTULO_RESULTADO[r.resultado] : "",
        PRAZO_DIAS[a.severidade],
        a.prazo ? dataBr(a.prazo.venceEm) : "",
        a.prazo ? rotuloPrazo(a.prazo) : "concluído",
        a.remediacao.curtoPrazo,
        a.remediacao.longoPrazo,
      ]),
    );
  }
  return `﻿${linhas.join("\r\n")}\r\n`;
}

import type { AchadoVerificavel } from "@/lib/tipos";
import { ROTULO_RESULTADO, ROTULO_STATUS } from "@/lib/verificacao";

/**
 * Exportação por achado (aba Verificação).
 *
 * Diferente de `lib/exportacao.ts` (relatório inteiro para Jira/GitHub),
 * aqui cada achado vira um texto autocontido em 3 formatos, copiado para
 * o clipboard. Funções puras — testadas em `exportacaoAchado.test.ts`.
 */

function linha(valor: string, vazio = "Não informado"): string {
  const v = valor.trim();
  return v.length > 0 ? v : vazio;
}

function blocoReteste(achado: AchadoVerificavel): string {
  const r = achado.ultimo_reteste;
  if (!r) return "Sem reteste registrado.";
  return `Data: ${r.data_reteste} · Resultado: ${ROTULO_RESULTADO[r.resultado] ?? r.resultado} · Evidência: ${linha(r.evidencia, "—")}`;
}

/** Jira wiki markup (h2/h3, *negrito*) — cola direto na descrição do ticket. */
export function formatarMarkdown(achado: AchadoVerificavel): string {
  return `
h2. ${achado.achado_ref}: ${achado.titulo}

*Cliente:* ${achado.cliente}
*Severidade:* ${achado.severidade}${achado.cwe ? ` *CWE:* ${achado.cwe}` : ""}
*Confiança:* ${achado.confianca}
*Status:* ${ROTULO_STATUS[achado.status]}${achado.data_reteste_sugerida ? ` *Reteste sugerido:* ${achado.data_reteste_sugerida}` : ""}

h3. Último reteste
${blocoReteste(achado)}

*Total de retestes:* ${achado.total_retestes}

---
Gerado por Laudo
`.trim();
}

/** JSON estruturado — cola no corpo de issue do GitHub ou consome via API. */
export function formatarJSON(achado: AchadoVerificavel): string {
  const r = achado.ultimo_reteste;
  return JSON.stringify(
    {
      ref: achado.achado_ref,
      titulo: achado.titulo,
      cliente: achado.cliente,
      severidade: achado.severidade,
      cwe: achado.cwe || null,
      confianca: achado.confianca,
      status: achado.status,
      data_reteste_sugerida: achado.data_reteste_sugerida,
      ultimo_reteste: r
        ? {
            data: r.data_reteste,
            resultado: r.resultado,
            evidencia: r.evidencia,
          }
        : null,
      total_retestes: achado.total_retestes,
    },
    null,
    2,
  );
}

/** Texto simples — cola em e-mail, chat ou campo sem formatação. */
export function formatarTextoSimples(achado: AchadoVerificavel): string {
  const partes = [
    `${achado.achado_ref}: ${achado.titulo}`,
    `Cliente: ${achado.cliente}`,
    `Severidade: ${achado.severidade}${achado.cwe ? ` (${achado.cwe})` : ""}`,
    `Confiança: ${achado.confianca}`,
    `Status: ${ROTULO_STATUS[achado.status]}`,
  ];
  if (achado.data_reteste_sugerida) {
    partes.push(`Reteste sugerido: ${achado.data_reteste_sugerida}`);
  }
  partes.push(`Último reteste: ${blocoReteste(achado)}`);
  partes.push(`Total de retestes: ${achado.total_retestes}`);
  return partes.join("\n");
}

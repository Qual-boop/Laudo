import type {
  AchadoVerificavel,
  Confianca,
  DeltaRelatorio,
  ResultadoReteste,
  StatusVerificacao,
} from "@/lib/tipos";

/**
 * Um reteste "parcial" não confirma a correção, então o achado NÃO fica
 * verificado. O detalhe fica preservado no resultado do reteste e no relatório
 * de delta — o badge é apenas a leitura conservadora.
 */
export function statusParaResultado(resultado: ResultadoReteste): StatusVerificacao {
  return resultado === "corrigido" ? "verificado" : "nao-corrigido";
}

export const ROTULO_RESULTADO: Record<ResultadoReteste, string> = {
  corrigido: "Corrigido",
  "nao-corrigido": "Não corrigido",
  parcial: "Parcial",
};

export const ROTULO_STATUS: Record<StatusVerificacao, string> = {
  pendente: "Pendente",
  verificado: "Verificado",
  "nao-corrigido": "Não corrigido",
};

/** Classes do badge de status — mesma paleta de severidade do relatório. */
export const ESTILO_STATUS: Record<StatusVerificacao, string> = {
  pendente: "border-media/30 bg-media/10 text-media",
  verificado: "border-accent/30 bg-accent/10 text-accent",
  "nao-corrigido": "border-critica/30 bg-critica/10 text-critica",
};

export const ROTULO_CONFIANCA: Record<Confianca, string> = {
  Alta: "Alta",
  Media: "Média",
  Baixa: "Baixa",
};

export function normalizarConfianca(v: unknown): Confianca {
  const s = String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (s.startsWith("alta")) return "Alta";
  if (s.startsWith("baixa")) return "Baixa";
  return "Media";
}

/** Rótulo do resultado final mostrado ao usuário. */
export function rotuloResultado(resultado: ResultadoReteste): string {
  return ROTULO_RESULTADO[resultado] ?? "Desconhecido";
}

/**
 * Monta o relatório de delta a partir do achado e do último reteste.
 * Determinístico de propósito: os dados já existem, não há por que gastar
 * token de IA — e assim funciona mesmo sem provedor configurado.
 */
export function montarDelta(achado: AchadoVerificavel): DeltaRelatorio | null {
  const reteste = achado.ultimo_reteste;
  if (!reteste) return null;

  return {
    achado: {
      titulo: achado.titulo,
      severidade: achado.severidade,
      achadoRef: achado.achado_ref,
      confianca: achado.confianca,
      cliente: achado.cliente,
      dataOriginal: (achado.criado_em || "").slice(0, 10),
    },
    reteste: {
      data: reteste.data_reteste,
      resultado: reteste.resultado,
      rotulo: rotuloResultado(reteste.resultado),
      evidencia: reteste.evidencia || "",
    },
    statusFinal: achado.status,
    statusFinalRotulo: ROTULO_STATUS[achado.status],
  };
}

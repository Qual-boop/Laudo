import { createHash } from "node:crypto";
import type {
  ResultadoReteste,
  Severidade,
  StatusVerificacao,
} from "@/lib/tipos";

/** Versão do documento — qualquer mudança no payload exige subir a versão. */
export const DOCUMENTO_CERTIFICADO = "laudo.certificado-correcao.v1";

export type AchadoCertificado = {
  ref: string;
  titulo: string;
  severidade: Severidade;
  status: StatusVerificacao;
  dataReteste: string | null;
  resultado: ResultadoReteste | null;
};

export type DadosCertificado = {
  relatorio: {
    id: number;
    cliente: string;
    titulo: string;
    data: string;
    versao: string;
  };
  achados: AchadoCertificado[];
  /** Data de emissão (YYYY-MM-DD). */
  emitidoEm: string;
};

export type ProgressoCertificado = {
  total: number;
  verificados: number;
  pendentes: number;
  naoCorrigidos: number;
  percentual: number;
  /** Emitível apenas com ao menos um achado e todos verificados. */
  completo: boolean;
};

export function progressoCertificado(
  achados: AchadoCertificado[],
): ProgressoCertificado {
  const total = achados.length;
  const verificados = achados.filter((a) => a.status === "verificado").length;
  const pendentes = achados.filter((a) => a.status === "pendente").length;
  const naoCorrigidos = achados.filter(
    (a) => a.status === "nao-corrigido",
  ).length;

  return {
    total,
    verificados,
    pendentes,
    naoCorrigidos,
    percentual: total === 0 ? 0 : Math.round((verificados / total) * 100),
    completo: total > 0 && verificados === total,
  };
}

/**
 * JSON com as chaves ordenadas recursivamente: o mesmo dado vira sempre a
 * mesma string, independentemente da ordem em que o objeto foi montado.
 * É isso que permite recomputar o hash fora da aplicação.
 */
export function serializarCanonico(valor: unknown): string {
  if (valor === undefined) return "null";
  if (valor === null || typeof valor !== "object") {
    return JSON.stringify(valor);
  }
  if (Array.isArray(valor)) {
    return `[${valor.map(serializarCanonico).join(",")}]`;
  }

  const entradas = Object.entries(valor as Record<string, unknown>)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entradas
    .map(([chave, v]) => `${JSON.stringify(chave)}:${serializarCanonico(v)}`)
    .join(",")}}`;
}

/**
 * Texto exato que entra no hash (JSON canônico, UTF-8). Os achados são
 * ordenados por referência antes de serializar — a ordem do `ORDER BY` do
 * banco não pode mudar o hash. É também o arquivo que o link público
 * oferece para quem quiser recalcular o hash fora da aplicação.
 */
export function payloadCanonico(dados: DadosCertificado): string {
  return serializarCanonico({
    documento: DOCUMENTO_CERTIFICADO,
    emitidoEm: dados.emitidoEm,
    relatorio: dados.relatorio,
    achados: [...dados.achados].sort((a, b) =>
      // Codepoint (não localeCompare): determinístico em qualquer ICU/Node.
      a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0,
    ),
  });
}

/** SHA-256 (hex) do payload canônico. */
export function hashCertificado(dados: DadosCertificado): string {
  return createHash("sha256").update(payloadCanonico(dados)).digest("hex");
}

/** 64 hex em 8 blocos de 8 — cabe numa linha e continua legível para conferir. */
export function formatarHash(hash: string): string {
  return (hash.match(/.{1,8}/g) ?? []).join(" ");
}

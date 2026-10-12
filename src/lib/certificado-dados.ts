import db from "@/lib/db";
import {
  hashCertificado,
  progressoCertificado,
  type AchadoCertificado,
  type DadosCertificado,
} from "@/lib/certificado";
import type {
  ResultadoReteste,
  Severidade,
  StatusVerificacao,
} from "@/lib/tipos";

/**
 * Dados do certificado (lib pura — usada pela página e pela API v1).
 * Rota de API já é dinâmica (lê o request); aqui sem `cache`/`connection`.
 */

type LinhaRelatorio = {
  id: number;
  cliente: string;
  titulo: string;
  data: string;
  versao: string;
};

type LinhaAchado = {
  achado_ref: string;
  titulo: string;
  severidade: string;
  status: string;
  data_reteste: string | null;
  resultado: string | null;
};

const SEVERIDADES: Severidade[] = ["Critica", "Alta", "Media", "Baixa"];
const STATUS: StatusVerificacao[] = ["pendente", "verificado", "nao-corrigido"];
const RESULTADOS: ResultadoReteste[] = ["corrigido", "nao-corrigido", "parcial"];

export type Certificado = {
  dados: DadosCertificado;
  progresso: ReturnType<typeof progressoCertificado>;
  hash: string;
};

/** Dono do relatório (para 403) ou null se não existe. */
export function donoDoRelatorio(relatorioId: number): number | null {
  const linha = db
    .prepare("SELECT usuario_id FROM relatorios WHERE id = ?")
    .get(relatorioId) as { usuario_id: number | null } | undefined;
  return linha ? linha.usuario_id : null;
}

export function carregarDadosCertificado(id: number): Certificado | null {
  const relatorio = db
    .prepare("SELECT id, cliente, titulo, data, versao FROM relatorios WHERE id = ?")
    .get(id) as LinhaRelatorio | undefined;

  if (!relatorio) return null;

  const linhas = db
    .prepare(
      `SELECT a.achado_ref, a.titulo, a.severidade, a.status,
              (SELECT r.data_reteste FROM retestes r
                WHERE r.achado_id = a.id
                ORDER BY date(r.data_reteste) DESC, r.id DESC LIMIT 1) AS data_reteste,
              (SELECT r.resultado FROM retestes r
                WHERE r.achado_id = a.id
                ORDER BY date(r.data_reteste) DESC, r.id DESC LIMIT 1) AS resultado
         FROM achados_verificacao a
        WHERE a.relatorio_id = ?
        ORDER BY a.id`,
    )
    .all(id) as LinhaAchado[];

  const achados: AchadoCertificado[] = linhas.map((l) => ({
    ref: String(l.achado_ref),
    titulo: String(l.titulo),
    severidade: (SEVERIDADES.includes(l.severidade as Severidade)
      ? l.severidade
      : "Media") as Severidade,
    status: (STATUS.includes(l.status as StatusVerificacao)
      ? l.status
      : "pendente") as StatusVerificacao,
    dataReteste: l.data_reteste ? String(l.data_reteste) : null,
    resultado: (RESULTADOS.includes(l.resultado as ResultadoReteste)
      ? l.resultado
      : null) as ResultadoReteste | null,
  }));

  // Data de emissão derivada do dado gravado (último reteste, senão a data do
  // relatório) e não de `new Date()`: o hash continua conferível dias depois.
  const datasReteste = achados
    .map((a) => a.dataReteste)
    .filter((d): d is string => Boolean(d))
    .sort();
  const emitidoEm = datasReteste.at(-1) ?? relatorio.data;

  const dados: DadosCertificado = {
    relatorio: {
      id: Number(relatorio.id),
      cliente: relatorio.cliente,
      titulo: relatorio.titulo,
      data: relatorio.data,
      versao: relatorio.versao,
    },
    achados,
    emitidoEm,
  };

  return {
    dados,
    progresso: progressoCertificado(achados),
    hash: hashCertificado(dados),
  };
}

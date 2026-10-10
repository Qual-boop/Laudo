export type Severidade = "Critica" | "Alta" | "Media" | "Baixa";
export type RiscoGeral = "Critico" | "Alto" | "Medio" | "Baixo";

/** Confiança que o pentester tem no achado. */
export type Confianca = "Alta" | "Media" | "Baixa";

/** Estado do ciclo de verificação de correções. */
export type StatusVerificacao = "pendente" | "verificado" | "nao-corrigido";

/** Resultado registrado em um reteste. */
export type ResultadoReteste = "corrigido" | "nao-corrigido" | "parcial";

export type Capa = {
  titulo: string;
  cliente: string;
  data: string;
  versao: string;
  classificacao: string;
};

export type ResumoPorSeveridade = {
  critica: number;
  alta: number;
  media: number;
  baixa: number;
};

export type SumarioExecutivo = {
  visaoGeral: string;
  riscoGeral: RiscoGeral;
  totalAchados: number;
  resumoPorSeveridade: ResumoPorSeveridade;
  principaisRiscos: string[];
};

export type EscopoMetodologia = {
  escopo: string;
  metodologia: string;
  ferramentas: string[];
  limitacoes: string;
  periodo: string;
};

export type Remediacao = {
  curtoPrazo: string;
  longoPrazo: string;
  referencias: string[];
};

export type Achado = {
  id: string;
  titulo: string;
  severidade: Severidade;
  cvss: {
    score: number;
    vetor: string;
  };
  cwe: string;
  owasp: string;
  descricaoTecnica: string;
  impactoNegocio: string;
  evidencias: string;
  passosReproducao: string[];
  remediacao: Remediacao;
  /** Confiança do pentester — vem do formulário, não da IA. */
  confianca: Confianca;
  /** Data sugerida para o reteste (YYYY-MM-DD), opcional. */
  dataRetesteSugerida: string | null;
};

export type RecomendacaoGeral = {
  prioridade: Severidade;
  recomendacao: string;
  justificativa: string;
};

export type Relatorio = {
  capa: Capa;
  sumarioExecutivo: SumarioExecutivo;
  escopoMetodologia: EscopoMetodologia;
  achados: Achado[];
  recomendacoesGerais: RecomendacaoGeral[];
  conclusao: string;
  disclaimer: string;
};

/* ---------- O que o formulário do pentester coleta ---------- */

export type AchadoEntrada = {
  titulo: string;
  severidade: Severidade;
  cwe: string;
  descricao: string;
  evidencia: string;
  confianca: Confianca;
  dataRetesteSugerida: string;
};

export type RelatorioEntrada = {
  cliente: string;
  titulo: string;
  escopo: string;
  periodo: string;
  limitacoes: string;
  ferramentas: string;
  achados: AchadoEntrada[];
};

/* ---------- Lista de relatórios salvos ---------- */

export type ResumoRelatorio = {
  id: number;
  cliente: string;
  titulo: string;
  data: string;
  versao: string;
  risco_geral: string;
  total_achados: number;
  criado_em: string;
};

/* ---------- Verificação de correções ---------- */

export type Reteste = {
  id: number;
  achado_id: number;
  data_reteste: string;
  resultado: ResultadoReteste;
  evidencia: string;
  criado_em: string;
};

export type AchadoVerificavel = {
  id: number;
  relatorio_id: number | null;
  cliente: string;
  achado_ref: string;
  titulo: string;
  severidade: Severidade;
  cwe: string;
  confianca: Confianca;
  data_reteste_sugerida: string | null;
  status: StatusVerificacao;
  criado_em: string;
  /** Último reteste registrado, ou null se ainda pendente. */
  ultimo_reteste: Reteste | null;
  total_retestes: number;
};

/* ---------- Relatório de delta ---------- */

export type DeltaRelatorio = {
  achado: {
    titulo: string;
    severidade: Severidade;
    achadoRef: string;
    confianca: Confianca;
    cliente: string;
    dataOriginal: string;
  };
  reteste: {
    data: string;
    resultado: ResultadoReteste;
    rotulo: string;
    evidencia: string;
  };
  statusFinal: StatusVerificacao;
  statusFinalRotulo: string;
};

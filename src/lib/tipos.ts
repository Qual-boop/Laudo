export type Severidade = "Critica" | "Alta" | "Media" | "Baixa";
export type RiscoGeral = "Critico" | "Alto" | "Medio" | "Baixo";

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

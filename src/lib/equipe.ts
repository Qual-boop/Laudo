/** Tipos de equipe e revisão compartilhados entre API e interface. */

export type Comentario = {
  id: number;
  achadoRef: string | null;
  texto: string;
  autor: string;
  meu: boolean;
  criadoEm: string;
};

export type RelatorioCompartilhado = {
  id: number;
  cliente: string;
  titulo: string;
  data: string;
  total_achados: number;
  dono: string;
};

export type MembroEquipe = {
  id: number;
  nome: string;
  email?: string;
  papel: string;
};

export type EquipeRelatorio = {
  papel: "dono" | "revisor";
  dono: string;
  membros: MembroEquipe[];
  limite: number;
};

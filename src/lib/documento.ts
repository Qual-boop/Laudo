import { buscarTodos, buscarUm } from "@/lib/banco";
import { assinaturaDe } from "@/lib/assinatura";
import { lerMarca, type Marca } from "@/lib/marca";
import { LIMITES, type Plano } from "@/lib/planos";
import { situacaoPrazo, type SituacaoPrazo } from "@/lib/prazos";
import type {
  Achado,
  Relatorio,
  ResultadoReteste,
  Severidade,
  StatusVerificacao,
} from "@/lib/tipos";
import { buscarUsuarioPorId } from "@/lib/usuarios";

/**
 * Dados do documento final (PDF e resumo executivo) de um relatório salvo:
 * o JSON do relatório normalizado + o estado de verificação de cada achado
 * + a marca do DONO (é a consultoria dele que assina, mesmo quando um
 * revisor abre o documento).
 */

export const ORDEM_SEVERIDADE: Severidade[] = ["Critica", "Alta", "Media", "Baixa"];

export const ROTULO_SEVERIDADE: Record<Severidade, string> = {
  Critica: "Crítica",
  Alta: "Alta",
  Media: "Média",
  Baixa: "Baixa",
};

export type Verificacao = {
  status: StatusVerificacao;
  ultimoReteste: { data: string; resultado: ResultadoReteste; evidencia: string } | null;
  totalRetestes: number;
};

export type AchadoDocumento = Achado & {
  verificacao: Verificacao | null;
  prazo: SituacaoPrazo | null;
};

export type Documento = {
  id: number;
  relatorio: Relatorio;
  achados: AchadoDocumento[];
  criadoEm: string;
  planoDono: Plano;
  /** Só preenchida quando o plano do dono inclui marca própria. */
  marca: Marca | null;
  marcaDagua: boolean;
  resumo: {
    total: number;
    porSeveridade: Record<Severidade, number>;
    verificados: number;
    naoCorrigidos: number;
    pendentes: number;
    atrasados: number;
  };
};

function texto(v: unknown, padrao = ""): string {
  return typeof v === "string" ? v : v == null ? padrao : String(v);
}

function lista<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function severidade(v: unknown): Severidade {
  return ORDEM_SEVERIDADE.includes(v as Severidade) ? (v as Severidade) : "Media";
}

/** O JSON salvo pode ser parcial (editado à mão, versão antiga): completa. */
export function normalizarRelatorio(bruto: unknown): Relatorio {
  const r = (bruto ?? {}) as Record<string, unknown>;
  const capa = (r.capa ?? {}) as Record<string, unknown>;
  const sum = (r.sumarioExecutivo ?? {}) as Record<string, unknown>;
  const esc = (r.escopoMetodologia ?? {}) as Record<string, unknown>;
  const achados = lista<Record<string, unknown>>(r.achados).map((a, i): Achado => {
    const cvss = (a.cvss ?? {}) as Record<string, unknown>;
    const rem = (a.remediacao ?? {}) as Record<string, unknown>;
    return {
      id: texto(a.id) || `FINDING-${String(i + 1).padStart(3, "0")}`,
      titulo: texto(a.titulo, "Achado sem título"),
      severidade: severidade(a.severidade),
      cvss: {
        score: typeof cvss.score === "number" ? cvss.score : Number.NaN,
        vetor: texto(cvss.vetor),
      },
      cwe: texto(a.cwe),
      owasp: texto(a.owasp),
      descricaoTecnica: texto(a.descricaoTecnica),
      impactoNegocio: texto(a.impactoNegocio),
      evidencias: texto(a.evidencias),
      passosReproducao: lista<unknown>(a.passosReproducao).map((p) => texto(p)).filter(Boolean),
      remediacao: {
        curtoPrazo: texto(rem.curtoPrazo),
        longoPrazo: texto(rem.longoPrazo),
        referencias: lista<unknown>(rem.referencias).map((x) => texto(x)).filter(Boolean),
      },
      confianca: a.confianca === "Alta" || a.confianca === "Baixa" ? a.confianca : "Media",
      dataRetesteSugerida: texto(a.dataRetesteSugerida) || null,
    };
  });
  const contar = (s: Severidade) => achados.filter((a) => a.severidade === s).length;
  return {
    capa: {
      titulo: texto(capa.titulo, "Relatório de Teste de Intrusão"),
      cliente: texto(capa.cliente, "Cliente"),
      data: texto(capa.data),
      versao: texto(capa.versao, "1.0"),
      classificacao: texto(capa.classificacao, "Confidencial"),
    },
    sumarioExecutivo: {
      visaoGeral: texto(sum.visaoGeral),
      riscoGeral: (["Critico", "Alto", "Medio", "Baixo"].includes(texto(sum.riscoGeral))
        ? sum.riscoGeral
        : "Medio") as Relatorio["sumarioExecutivo"]["riscoGeral"],
      totalAchados: achados.length,
      resumoPorSeveridade: {
        critica: contar("Critica"),
        alta: contar("Alta"),
        media: contar("Media"),
        baixa: contar("Baixa"),
      },
      principaisRiscos: lista<unknown>(sum.principaisRiscos).map((x) => texto(x)).filter(Boolean),
    },
    escopoMetodologia: {
      escopo: texto(esc.escopo),
      metodologia: texto(esc.metodologia),
      ferramentas: lista<unknown>(esc.ferramentas).map((x) => texto(x)).filter(Boolean),
      limitacoes: texto(esc.limitacoes),
      periodo: texto(esc.periodo),
    },
    achados,
    recomendacoesGerais: lista<Record<string, unknown>>(r.recomendacoesGerais).map((x) => ({
      prioridade: severidade(x.prioridade),
      recomendacao: texto(x.recomendacao),
      justificativa: texto(x.justificativa),
    })),
    conclusao: texto(r.conclusao),
    disclaimer: texto(r.disclaimer),
  };
}

type LinhaVerificacao = {
  achado_ref: string;
  status: string;
  total: number;
  data_reteste: string | null;
  resultado: string | null;
  evidencia: string | null;
};

export async function carregarDocumento(id: number): Promise<Documento | null> {
  const linha = await buscarUm<{ usuario_id: number | null; relatorio_json: string; criado_em: string }>(
    "SELECT usuario_id, relatorio_json, criado_em FROM relatorios WHERE id = ?",
    id,
  );
  if (!linha || linha.usuario_id === null) return null;

  let bruto: unknown = null;
  try {
    bruto = JSON.parse(linha.relatorio_json);
  } catch {
    return null;
  }
  const relatorio = normalizarRelatorio(bruto);

  const verificacoes = await buscarTodos<LinhaVerificacao>(
    `SELECT a.achado_ref, a.status,
            (SELECT COUNT(*) FROM retestes r WHERE r.achado_id = a.id) AS total,
            (SELECT r.data_reteste FROM retestes r WHERE r.achado_id = a.id
              ORDER BY r.data_reteste DESC, r.id DESC LIMIT 1) AS data_reteste,
            (SELECT r.resultado FROM retestes r WHERE r.achado_id = a.id
              ORDER BY r.data_reteste DESC, r.id DESC LIMIT 1) AS resultado,
            (SELECT r.evidencia FROM retestes r WHERE r.achado_id = a.id
              ORDER BY r.data_reteste DESC, r.id DESC LIMIT 1) AS evidencia
       FROM achados_verificacao a WHERE a.relatorio_id = ?`,
    id,
  );
  const porRef = new Map(verificacoes.map((v) => [String(v.achado_ref), v]));
  const criadoEm = String(linha.criado_em);

  const achados: AchadoDocumento[] = relatorio.achados.map((a) => {
    const v = porRef.get(a.id);
    const status = (["pendente", "verificado", "nao-corrigido"].includes(String(v?.status))
      ? v?.status
      : "pendente") as StatusVerificacao;
    return {
      ...a,
      verificacao: v
        ? {
            status,
            totalRetestes: Number(v.total) || 0,
            ultimoReteste:
              v.data_reteste && v.resultado
                ? {
                    data: String(v.data_reteste),
                    resultado: v.resultado as ResultadoReteste,
                    evidencia: texto(v.evidencia),
                  }
                : null,
          }
        : null,
      prazo: status === "verificado" ? null : situacaoPrazo(a.severidade, criadoEm),
    };
  });

  const dono = await buscarUsuarioPorId(Number(linha.usuario_id));
  const planoDono = dono ? (await assinaturaDe(dono)).plano : "free";
  const limites = LIMITES[planoDono];

  const porSeveridade = Object.fromEntries(
    ORDEM_SEVERIDADE.map((s) => [s, achados.filter((a) => a.severidade === s).length]),
  ) as Record<Severidade, number>;

  return {
    id,
    relatorio,
    achados,
    criadoEm,
    planoDono,
    marca: limites.marcaPropria ? await lerMarca(Number(linha.usuario_id)) : null,
    marcaDagua: limites.marcaDagua,
    resumo: {
      total: achados.length,
      porSeveridade,
      verificados: achados.filter((a) => a.verificacao?.status === "verificado").length,
      naoCorrigidos: achados.filter((a) => a.verificacao?.status === "nao-corrigido").length,
      pendentes: achados.filter((a) => (a.verificacao?.status ?? "pendente") === "pendente").length,
      atrasados: achados.filter((a) => a.prazo?.estado === "atrasado").length,
    },
  };
}

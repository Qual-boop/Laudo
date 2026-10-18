import { situacaoPrazo } from "@/lib/prazos";
import type { ResultadoReteste, Severidade, StatusVerificacao } from "@/lib/tipos";

/**
 * Quadro de evidências para auditoria (PCI DSS, ISO/IEC 27001, LGPD e
 * Banco Central). Cada linha cita o requisito e diz qual evidência o
 * Laudo registrou — nunca afirma "conforme": quem avalia é o auditor/QSA
 * e o responsável pela conformidade.
 */

export type EstadoEvidencia = "evidenciado" | "parcial" | "sem-evidencia";

export type ItemQuadro = {
  referencia: string;
  requisito: string;
  evidencia: string;
  estado: EstadoEvidencia;
};

export type Marco = {
  id: "pci" | "iso27001" | "lgpd" | "bcb";
  nome: string;
  nota?: string;
  itens: ItemQuadro[];
};

export type AchadoConformidade = {
  ref: string;
  severidade: Severidade;
  status: StatusVerificacao;
  dataReteste: string | null;
  resultado: ResultadoReteste | null;
  /** Momento da entrega (criado_em do achado). */
  entregueEm: string;
  cvss: number | null;
};

export type DadosConformidade = {
  cliente: string;
  titulo: string;
  /** Data do relatório (YYYY-MM-DD). */
  data: string;
  periodo: string;
  escopo: string;
  metodologia: string;
  achados: AchadoConformidade[];
  hashCertificado: string | null;
};

export const AVISO_CONFORMIDADE =
  "Este quadro organiza as evidências registradas no Laudo para apoiar auditorias e due diligence. Não é atestado de conformidade, certificação nem parecer jurídico: a avaliação de cada requisito cabe ao auditor (QSA, no PCI DSS) e ao responsável pela conformidade da organização.";

const DIA = 86_400_000;

function dataBr(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function mesesDesde(iso: string, hoje: Date): number | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const base = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const agora = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return (agora - base) / (30.44 * DIA);
}

export function resumirAchados(achados: AchadoConformidade[], hoje: Date = new Date()) {
  const total = achados.length;
  const verificados = achados.filter((a) => a.status === "verificado");
  const abertos = achados.filter((a) => a.status !== "verificado");
  const retestados = achados.filter((a) => a.dataReteste);
  const comCvss = achados.filter((a) => a.cvss !== null).length;
  const atrasados = abertos.filter(
    (a) => situacaoPrazo(a.severidade, a.entregueEm, hoje)?.estado === "atrasado",
  );
  return { total, verificados, abertos, retestados, comCvss, atrasados };
}

export function montarQuadro(d: DadosConformidade, hoje: Date = new Date()): Marco[] {
  const r = resumirAchados(d.achados, hoje);
  const idade = mesesDesde(d.data, hoje);
  const recente = idade !== null && idade <= 12;
  const ciclo = r.total > 0 && r.verificados.length === r.total;
  const abertosRefs = r.abertos.map((a) => a.ref).join(", ");

  const evidTeste = `Teste de intrusão "${d.titulo}" para ${d.cliente}, relatório de ${dataBr(d.data)}${
    d.periodo ? ` (período: ${d.periodo})` : ""
  }. Escopo: ${d.escopo || "não informado no relatório"}.`;

  const evidCorrecao = ciclo
    ? `Todos os ${r.total} achados foram retestados e verificados como corrigidos${
        d.hashCertificado ? `; certificado de correção SHA-256 ${d.hashCertificado.slice(0, 16)}…` : ""
      }.`
    : `${r.verificados.length} de ${r.total} achados verificados como corrigidos. Em aberto: ${abertosRefs || "—"}.`;

  const estadoCorrecao: EstadoEvidencia = r.total === 0 ? "sem-evidencia" : ciclo ? "evidenciado" : r.retestados.length > 0 ? "parcial" : "sem-evidencia";

  const evidPrazos = r.abertos.length
    ? `${r.abertos.length} em aberto, ${r.atrasados.length} fora do prazo de referência por severidade (crítica 7, alta 30, média 90, baixa 180 dias).`
    : "Nenhum achado em aberto.";

  return [
    {
      id: "pci",
      nome: "PCI DSS v4.0.1 — Requisito 11.4 e 6.3.1",
      itens: [
        {
          referencia: "11.4.1",
          requisito: "Metodologia de teste de intrusão definida, documentada e implementada.",
          evidencia: d.metodologia
            ? `Metodologia registrada no relatório: ${d.metodologia.slice(0, 280)}${d.metodologia.length > 280 ? "…" : ""}`
            : "O relatório não descreve a metodologia.",
          estado: d.metodologia ? "evidenciado" : "sem-evidencia",
        },
        {
          referencia: "11.4.2 / 11.4.3",
          requisito:
            "Teste de intrusão interno e externo ao menos a cada 12 meses e após mudança significativa.",
          evidencia: `${evidTeste} ${
            recente ? "Realizado nos últimos 12 meses." : "Realizado há mais de 12 meses — programar novo teste."
          } O escopo informado indica se a evidência cobre o teste interno, o externo ou ambos.`,
          estado: recente ? "evidenciado" : "parcial",
        },
        {
          referencia: "11.4.4",
          requisito:
            "Vulnerabilidades exploráveis e fraquezas encontradas são corrigidas e o teste é repetido para verificar as correções.",
          evidencia: evidCorrecao,
          estado: estadoCorrecao,
        },
        {
          referencia: "6.3.1",
          requisito: "Vulnerabilidades de segurança são identificadas e recebem classificação de risco.",
          evidencia:
            r.total > 0
              ? `${r.total} achados classificados por severidade; ${r.comCvss} com nota CVSS v3.1 calculada a partir do vetor.`
              : "Nenhum achado registrado.",
          estado: r.total > 0 ? "evidenciado" : "sem-evidencia",
        },
      ],
    },
    {
      id: "iso27001",
      nome: "ISO/IEC 27001:2022 — Anexo A",
      itens: [
        {
          referencia: "A.8.8",
          requisito: "Gestão de vulnerabilidades técnicas: obter informação, avaliar a exposição e tomar medidas.",
          evidencia: `Identificação: ${r.total} achados. Avaliação: severidade e CVSS. Tratamento: ${evidCorrecao} Prazos: ${evidPrazos}`,
          estado: estadoCorrecao,
        },
        {
          referencia: "A.8.29",
          requisito: "Testes de segurança em desenvolvimento e aceitação.",
          evidencia: `${evidTeste} Retestes registrados: ${r.retestados.length}.`,
          estado: r.total > 0 ? "evidenciado" : "sem-evidencia",
        },
      ],
    },
    {
      id: "lgpd",
      nome: "LGPD — Lei nº 13.709/2018",
      nota: "Teste de intrusão é uma das medidas técnicas que apoiam estes artigos; não esgota as obrigações da lei.",
      itens: [
        {
          referencia: "Art. 46",
          requisito:
            "Medidas de segurança, técnicas e administrativas aptas a proteger os dados pessoais de acessos não autorizados e de situações acidentais ou ilícitas.",
          evidencia: `Avaliação técnica de segurança realizada (${dataBr(d.data)}) e correções comprovadas por reteste: ${r.verificados.length} de ${r.total}.`,
          estado: r.total === 0 ? "sem-evidencia" : ciclo ? "evidenciado" : "parcial",
        },
        {
          referencia: "Art. 49",
          requisito:
            "Sistemas utilizados no tratamento de dados pessoais estruturados para atender aos requisitos de segurança.",
          evidencia: `Sistemas avaliados: ${d.escopo || "escopo não informado"}. ${evidPrazos}`,
          estado: r.total === 0 ? "sem-evidencia" : r.atrasados.length === 0 ? "evidenciado" : "parcial",
        },
      ],
    },
    {
      id: "bcb",
      nome: "Banco Central — Resolução CMN nº 4.893/2021",
      nota:
        "Redação dada pela Resolução CMN nº 5.274/2025. Aplica-se a instituições autorizadas pelo BCB abrangidas pela norma; confirme o enquadramento e o normativo aplicável à sua instituição.",
      itens: [
        {
          referencia: "Testes de intrusão",
          requisito:
            "Realização de testes de intrusão, conduzidos por parte independente, com documentação dos resultados, das vulnerabilidades e dos planos de ação.",
          evidencia: `${evidTeste} Resultados e vulnerabilidades documentados no relatório; plano de ação por achado (remediação de curto e longo prazo). A independência de quem executou o teste deve ser comprovada à parte.`,
          estado: r.total > 0 ? "parcial" : "sem-evidencia",
        },
        {
          referencia: "Correção tempestiva",
          requisito: "Correção tempestiva das vulnerabilidades identificadas.",
          evidencia: `${evidCorrecao} ${evidPrazos}`,
          estado: r.total === 0 ? "sem-evidencia" : ciclo ? "evidenciado" : r.atrasados.length ? "sem-evidencia" : "parcial",
        },
      ],
    },
  ];
}

export function contarEstados(marcos: Marco[]): Record<EstadoEvidencia, number> {
  const c: Record<EstadoEvidencia, number> = { evidenciado: 0, parcial: 0, "sem-evidencia": 0 };
  for (const m of marcos) for (const i of m.itens) c[i.estado]++;
  return c;
}

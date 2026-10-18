import { buscarTodos, buscarUm } from "@/lib/banco";
import { carregarDadosCertificado } from "@/lib/certificado-dados";
import type { AchadoConformidade, DadosConformidade } from "@/lib/conformidade";
import type { ResultadoReteste, Severidade, StatusVerificacao } from "@/lib/tipos";

function objeto(v: unknown): Record<string, unknown> {
  if (typeof v === "string") {
    try {
      return objeto(JSON.parse(v));
    } catch {
      return {};
    }
  }
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

const txt = (v: unknown) => (typeof v === "string" ? v : "");

/** Monta os dados do quadro a partir do relatório salvo e dos retestes. */
export async function carregarDadosConformidade(id: number): Promise<DadosConformidade | null> {
  const rel = await buscarUm<{ cliente: string; titulo: string; data: string; relatorio_json: unknown }>(
    "SELECT cliente, titulo, data, relatorio_json FROM relatorios WHERE id = ?",
    id,
  );
  if (!rel) return null;

  const json = objeto(rel.relatorio_json);
  const escopo = objeto(json.escopoMetodologia);
  const cvssPorRef = new Map<string, number>();
  for (const a of Array.isArray(json.achados) ? json.achados.map(objeto) : []) {
    const score = Number(objeto(a.cvss).score);
    if (txt(a.id) && Number.isFinite(score) && score > 0) cvssPorRef.set(txt(a.id), score);
  }

  const linhas = await buscarTodos<{
    achado_ref: string;
    severidade: string;
    status: string;
    criado_em: unknown;
    data_reteste: string | null;
    resultado: string | null;
  }>(
    `SELECT a.achado_ref, a.severidade, a.status, a.criado_em,
            (SELECT r.data_reteste FROM retestes r WHERE r.achado_id = a.id
              ORDER BY r.data_reteste DESC, r.id DESC LIMIT 1) AS data_reteste,
            (SELECT r.resultado FROM retestes r WHERE r.achado_id = a.id
              ORDER BY r.data_reteste DESC, r.id DESC LIMIT 1) AS resultado
       FROM achados_verificacao a
      WHERE a.relatorio_id = ?
      ORDER BY a.id`,
    id,
  );

  const achados: AchadoConformidade[] = linhas.map((l) => ({
    ref: l.achado_ref,
    severidade: l.severidade as Severidade,
    status: l.status as StatusVerificacao,
    dataReteste: l.data_reteste,
    resultado: l.resultado as ResultadoReteste | null,
    entregueEm: l.criado_em instanceof Date ? l.criado_em.toISOString() : String(l.criado_em ?? ""),
    cvss: cvssPorRef.get(l.achado_ref) ?? null,
  }));

  const certificado = await carregarDadosCertificado(id);

  return {
    cliente: rel.cliente,
    titulo: rel.titulo,
    data: rel.data,
    periodo: txt(escopo.periodo),
    escopo: txt(escopo.escopo),
    metodologia: txt(escopo.metodologia),
    achados,
    hashCertificado: certificado?.progresso.completo ? certificado.hash : null,
  };
}

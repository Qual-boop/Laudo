import { NextRequest } from "next/server";
import db from "@/lib/db";
import { normalizarConfianca } from "@/lib/verificacao";
import type { Relatorio } from "@/lib/tipos";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<Relatorio>;

  if (!body.capa || !Array.isArray(body.achados)) {
    return Response.json(
      { error: "Relatório incompleto: capa e achados são obrigatórios." },
      { status: 400 },
    );
  }

  // Narrowing explícito: o guarda acima não estreita o tipo de Partial<Relatorio>.
  const capa = body.capa;
  const achados = body.achados;

  const inserirRelatorio = db.prepare(
    `INSERT INTO relatorios (cliente, titulo, data, versao, risco_geral, total_achados, relatorio_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  const inserirAchado = db.prepare(
    `INSERT INTO achados_verificacao
       (relatorio_id, achado_ref, titulo, severidade, cwe, confianca, data_reteste_sugerida, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente')`,
  );

  // Relatório e achados entram juntos: um relatório salvo sem achados
  // verificáveis deixaria a aba Verificação inconsistente.
  const salvar = db.transaction(() => {
    const info = inserirRelatorio.run(
      capa.cliente || "Não informado",
      capa.titulo || "Relatório",
      capa.data || new Date().toISOString().slice(0, 10),
      capa.versao || "1.0",
      body.sumarioExecutivo?.riscoGeral || "Medio",
      achados.length,
      JSON.stringify(body),
    );

    const relatorioId = Number(info.lastInsertRowid);

    for (const [i, achado] of achados.entries()) {
      inserirAchado.run(
        relatorioId,
        achado.id || `FINDING-${String(i + 1).padStart(3, "0")}`,
        achado.titulo || "Achado sem título",
        achado.severidade || "Media",
        achado.cwe || null,
        normalizarConfianca(achado.confianca),
        achado.dataRetesteSugerida || null,
      );
    }

    return relatorioId;
  });

  const relatorioId = salvar();

  return Response.json({ id: relatorioId, achados: achados.length }, { status: 201 });
}

export async function GET() {
  const relatorios = db
    .prepare(
      `SELECT r.id, r.cliente, r.titulo, r.data, r.versao, r.risco_geral, r.total_achados, r.criado_em,
              (SELECT COUNT(*) FROM achados_verificacao a
                WHERE a.relatorio_id = r.id AND a.status = 'verificado') AS achados_verificados
       FROM relatorios r ORDER BY r.id DESC`,
    )
    .all();

  return Response.json(relatorios);
}

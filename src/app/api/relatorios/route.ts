import { NextRequest } from "next/server";
import db from "@/lib/db";
import type { Relatorio } from "@/lib/tipos";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<Relatorio>;

  if (!body.capa || !Array.isArray(body.achados)) {
    return Response.json(
      { error: "Relatório incompleto: capa e achados são obrigatórios." },
      { status: 400 },
    );
  }

  const stmt = db.prepare(
    `INSERT INTO relatorios (cliente, titulo, data, versao, risco_geral, total_achados, relatorio_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  const info = stmt.run(
    body.capa.cliente || "Não informado",
    body.capa.titulo || "Relatório",
    body.capa.data || new Date().toISOString().slice(0, 10),
    body.capa.versao || "1.0",
    body.sumarioExecutivo?.riscoGeral || "Medio",
    body.achados.length,
    JSON.stringify(body),
  );

  return Response.json({ id: info.lastInsertRowid }, { status: 201 });
}

export async function GET() {
  const relatorios = db
    .prepare(
      `SELECT id, cliente, titulo, data, versao, risco_geral, total_achados, criado_em
       FROM relatorios ORDER BY id DESC`,
    )
    .all();

  return Response.json(relatorios);
}

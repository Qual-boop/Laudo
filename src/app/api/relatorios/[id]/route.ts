import type { NextRequest } from "next/server";
import db from "@/lib/db";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/relatorios/[id]">) {
  const { id } = await ctx.params;

  const linha = db
    .prepare("SELECT relatorio_json FROM relatorios WHERE id = ?")
    .get(Number(id)) as { relatorio_json: string } | undefined;

  if (!linha) {
    return Response.json({ error: "Relatório não encontrado." }, { status: 404 });
  }

  return Response.json(JSON.parse(linha.relatorio_json));
}

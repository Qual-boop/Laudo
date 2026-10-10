import { NextResponse } from "next/server";

/**
 * Compatibilidade: a API agora vive em /api/v1/*.
 * 308 preserva método e corpo (o fetch do cliente refaz o POST no destino).
 */
export async function POST(request: Request) {
  return NextResponse.redirect(new URL("/api/v1/gerar", request.url), 308);
}

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/api/v1/gerar", request.url), 308);
}

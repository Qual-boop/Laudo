import { NextResponse } from "next/server";

/** Compatibilidade: a API agora vive em /api/v1/*. 308 preserva método e corpo. */
function destino(request: Request): URL {
  const url = new URL(request.url);
  url.pathname = "/api/v1/verificacao";
  return url;
}

export async function GET(request: Request) {
  return NextResponse.redirect(destino(request), 308);
}

export async function POST(request: Request) {
  return NextResponse.redirect(destino(request), 308);
}

export async function DELETE(request: Request) {
  return NextResponse.redirect(destino(request), 308);
}

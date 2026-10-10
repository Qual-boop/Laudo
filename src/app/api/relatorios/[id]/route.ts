import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** Compatibilidade: a API agora vive em /api/v1/*. 308 preserva o método. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  return NextResponse.redirect(
    new URL(`/api/v1/relatorios/${id}`, req.url),
    308,
  );
}

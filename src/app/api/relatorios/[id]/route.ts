import { redirecionarCompat } from "@/lib/compat-redirect";

/** Compatibilidade: a API agora vive em /api/v1/*. 308 preserva o método. */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  return redirecionarCompat(request, `/api/v1/relatorios/${id}`);
}

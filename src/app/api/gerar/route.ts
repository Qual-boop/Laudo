import { redirecionarCompat } from "@/lib/compat-redirect";

/**
 * Compatibilidade: a API agora vive em /api/v1/*.
 * 308 preserva método e corpo (o fetch do cliente refaz o POST no destino).
 */
export async function POST(request: Request) {
  return redirecionarCompat(request, "/api/v1/gerar");
}

export async function GET(request: Request) {
  return redirecionarCompat(request, "/api/v1/gerar");
}

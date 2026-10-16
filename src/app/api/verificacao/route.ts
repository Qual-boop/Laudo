import { redirecionarCompat } from "@/lib/compat-redirect";

/** Compatibilidade: a API agora vive em /api/v1/*. 308 preserva método e corpo. */
export async function GET(request: Request) {
  return redirecionarCompat(request, "/api/v1/verificacao");
}

export async function POST(request: Request) {
  return redirecionarCompat(request, "/api/v1/verificacao");
}

export async function DELETE(request: Request) {
  return redirecionarCompat(request, "/api/v1/verificacao");
}

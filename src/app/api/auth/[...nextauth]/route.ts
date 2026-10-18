import type { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { ipDoCliente, resposta429, verificarLogin } from "@/lib/limite-taxa";

export const { GET } = handlers;

/**
 * POST do NextAuth com rate limit no login por senha
 * (`/api/auth/callback/credentials`). Fica aqui e não no `authorize`
 * porque só o route handler consegue responder 429 com Retry-After.
 */
export async function POST(req: NextRequest) {
  if (req.nextUrl.pathname.endsWith("/callback/credentials")) {
    const form = await req.clone().formData().catch(() => null);
    const bloqueio = verificarLogin(ipDoCliente(req.headers), form?.get("email"));
    if (bloqueio) {
      // `signIn()` do next-auth/react lê `url` do corpo (new URL(data.url))
      // e devolve `status` — a tela de login mostra o aviso pelo 429.
      const url = new URL("/login", req.nextUrl.origin);
      url.searchParams.set("error", "MuitasTentativas");
      return resposta429(bloqueio, { url: url.toString() });
    }
  }
  return handlers.POST(req);
}

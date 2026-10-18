import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Middleware (Edge runtime).
 *
 * Usa `getToken` direto em vez do `auth()` do NextAuth: o `auth()` puxa
 * toda a config (que referencia @/lib/usuarios → better-sqlite3, nativo
 * Node) para o bundle Edge e quebra o build. Aqui só decodificamos o
 * JWT do cookie — jose é Edge-safe.
 */

/** Prefixos/páginas públicas (sem login). O painel exige sessão válida. */
const PUBLICO = [
  "/",
  "/login",
  "/cadastro",
  "/precos",
  "/apresentacao",
  "/termos",
  "/privacidade",
  "/api/auth",
  "/api/v1/auth",
  "/c", // link público do certificado (token de 256 bits; ver lib/certificado-publico.ts)
  "/icon.svg",
  "/manifest.json",
  "/sitemap.xml",
  "/robots.txt",
  "/favicon.ico",
  "/opengraph-image", // prévia de compartilhamento (crawlers não têm sessão)
];

function nomesCookie(): [string, string] {
  // Mesmo par de nomes de lib/api-auth.ts (duplicado aqui porque o
  // middleware é Edge e não pode importar a lib, que puxa better-sqlite3).
  // O Auth.js escolhe o prefixo __Secure- pelo protocolo efetivo, então
  // testamos os dois para nunca perder sessão válida por divergência.
  const principal =
    process.env.NODE_ENV === "production"
      ? "__Secure-authjs.session-token"
      : "authjs.session-token";
  const alternativo = principal.startsWith("__Secure-")
    ? "authjs.session-token"
    : "__Secure-authjs.session-token";
  return [principal, alternativo];
}

async function temSessao(req: NextRequest): Promise<boolean> {
  for (const cookieName of nomesCookie()) {
    try {
      const token = await getToken({
        req,
        secret: process.env.AUTH_SECRET,
        cookieName,
      });
      if (token) return true;
    } catch {
      // tenta o próximo nome
    }
  }
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next/") ||
    PUBLICO.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    return NextResponse.next();
  }

  let logado = false;
  try {
    logado = await temSessao(req);
  } catch {
    logado = false;
  }

  // API responde 401 JSON dentro da rota (via exigirUsuario) — aqui só páginas.
  // Páginas: padrão é exigir login (allowlist acima); só a API passa solta.
  if (!logado && !pathname.startsWith("/api/")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (logado && (pathname === "/login" || pathname === "/cadastro")) {
    const url = req.nextUrl.clone();
    url.pathname = "/painel";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

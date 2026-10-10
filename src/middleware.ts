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

/** Prefixos públicos (sem login). Todo o resto exige sessão válida. */
const PUBLICO = [
  "/login",
  "/cadastro",
  "/apresentacao",
  "/api/auth",
  "/api/v1/auth",
  "/icon.svg",
  "/manifest.json",
  "/sitemap.xml",
  "/robots.txt",
  "/favicon.ico",
];

function nomeCookie(): string {
  return process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
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
    const token = await getToken({
      req,
      secret: process.env.AUTH_SECRET,
      cookieName: nomeCookie(),
    });
    logado = !!token;
  } catch {
    logado = false;
  }

  // API responde 401 JSON dentro da rota (via exigirUsuario) — aqui só páginas.
  if (!logado && (pathname === "/" || pathname.startsWith("/certificado"))) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (logado && (pathname === "/login" || pathname === "/cadastro")) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

/**
 * POST /api/v1/auth/logout — encerra a sessão web.
 *
 * Motivo: o signout do NextAuth v5 não expira o cookie da sessão JWT,
 * então "sair" não grudava (o middleware seguia vendo a sessão). Aqui
 * expiramos os dois nomes possíveis de cookie de sessão + callback-url.
 */
function expirar(nome: string): string {
  return `${nome}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`;
}

export async function POST() {
  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", expirar("authjs.session-token"));
  headers.append(
    "Set-Cookie",
    expirar("__Secure-authjs.session-token"),
  );
  headers.append("Set-Cookie", expirar("authjs.callback-url"));
  headers.append("Set-Cookie", expirar("__Secure-authjs.callback-url"));
  return new Response(JSON.stringify({ ok: true }), { headers });
}

import { exigirUsuario, lerToken } from "@/lib/api-auth";
import { revogarSessao, revogarTodas } from "@/lib/sessoes";

/**
 * POST /api/v1/auth/logout — encerra a sessão web.
 *
 * Apaga a linha da sessão em `sessoes` (o JWT deixa de valer no servidor,
 * mesmo copiado) e expira os cookies. `?todos=1` encerra também as
 * sessões dos outros navegadores/apps ("sair de todos os dispositivos").
 *
 * Motivo dos cookies: o signout do NextAuth v5 não expira o cookie da
 * sessão JWT, então "sair" não grudava (o middleware seguia vendo a sessão).
 */
function expirar(nome: string): string {
  const seguro = nome.startsWith("__Secure-") ? "; Secure" : "";
  return `${nome}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${seguro}`;
}

export async function POST(request: Request) {
  const todos = new URL(request.url).searchParams.get("todos") === "1";
  let encerradas = 0;

  if (todos) {
    const auth = await exigirUsuario(request);
    if (auth.ok) encerradas = await revogarTodas(auth.usuario.id);
  } else {
    const token = await lerToken(request).catch(() => null);
    if (token?.sid !== undefined) {
      await revogarSessao(token.sid);
      encerradas = 1;
    }
  }

  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", expirar("authjs.session-token"));
  headers.append("Set-Cookie", expirar("__Secure-authjs.session-token"));
  headers.append("Set-Cookie", expirar("authjs.callback-url"));
  headers.append("Set-Cookie", expirar("__Secure-authjs.callback-url"));
  return new Response(JSON.stringify({ ok: true, encerradas }), { headers });
}

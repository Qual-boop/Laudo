/**
 * Redirecionamento 308 para a API nova (/api/v1/*), preservando método e corpo.
 *
 * O Location é RELATIVO de propósito: atrás de proxy (Railway), request.url
 * pode chegar com o host interno (localhost:8080) — um redirect absoluto
 * vazaria esse host e quebraria o cliente.
 */
export function redirecionarCompat(request: Request, destino: string): Response {
  const busca = new URL(request.url).search;
  return new Response(null, {
    status: 308,
    headers: { Location: `${destino}${busca}` },
  });
}

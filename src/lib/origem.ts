/**
 * Defesa CSRF explícita para a API (edge-safe: sem imports de Node).
 *
 * O cookie de sessão é SameSite=Lax, o que já barra a maioria dos POSTs
 * vindos de outro site — mas Lax tem brechas (subdomínios "same-site",
 * navegadores antigos, top-level POST em alguns fluxos). Aqui a regra é
 * direta: requisição que muda estado (POST/PUT/PATCH/DELETE) em /api/ só
 * passa se o navegador disser que veio do próprio site.
 *
 *  - `Origin` presente → precisa ser uma das origens do Provafix.
 *  - sem `Origin`, `Sec-Fetch-Site: cross-site` → recusa.
 *  - sem nenhum dos dois → passa: não é navegador (app mobile/desktop com
 *    Bearer, curl, webhook do Stripe), e esses não carregam cookie alheio.
 */

const METODOS_SEGUROS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Server-to-server: quem chama não é navegador (e nem manda Origin). */
const ISENTOS = ["/api/v1/webhook/"];

export function origensPermitidas(headers: Headers, appUrl = process.env.NEXT_PUBLIC_APP_URL): Set<string> {
  const origens = new Set<string>();
  if (appUrl) {
    try {
      origens.add(new URL(appUrl).origin);
    } catch {
      // URL inválida na env: ignora
    }
  }
  // Atrás do proxy do Railway o host público vem em X-Forwarded-Host.
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (host) {
    const proto = headers.get("x-forwarded-proto") ?? "https";
    origens.add(`${proto}://${host}`);
    // `next dev`/`next start` local em http.
    if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) origens.add(`http://${host}`);
  }
  return origens;
}

export type VereditoOrigem = { permitido: true } | { permitido: false; motivo: string };

export function verificarOrigem(
  metodo: string,
  caminho: string,
  headers: Headers,
  appUrl = process.env.NEXT_PUBLIC_APP_URL,
): VereditoOrigem {
  if (METODOS_SEGUROS.has(metodo.toUpperCase())) return { permitido: true };
  if (!caminho.startsWith("/api/")) return { permitido: true };
  if (ISENTOS.some((p) => caminho.startsWith(p))) return { permitido: true };

  const origem = headers.get("origin");
  if (origem) {
    return origensPermitidas(headers, appUrl).has(origem)
      ? { permitido: true }
      : { permitido: false, motivo: "origem não permitida" };
  }
  if (headers.get("sec-fetch-site") === "cross-site") {
    return { permitido: false, motivo: "requisição de outro site" };
  }
  return { permitido: true };
}

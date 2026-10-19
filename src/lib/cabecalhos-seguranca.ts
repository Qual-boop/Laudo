/**
 * Security headers globais (aplicados em `next.config.ts` → headers()).
 *
 * CSP sem nonce de propósito: com Cache Components o shell das páginas é
 * pré-renderizado e servido igual para todo mundo, então não há como
 * injetar um nonce por requisição sem tornar tudo dinâmico. O Next embute
 * scripts inline (bootstrap e payload RSC em `self.__next_f.push`), daí o
 * `'unsafe-inline'` em script-src. O resto fecha o que dá: nada de origem
 * externa, sem plugins, sem <base> trocado, formulários só para o próprio
 * site e a página não entra em iframe de ninguém.
 */

export type Cabecalho = { key: string; value: string };

export function politicaCsp(dev: boolean): string {
  const diretivas: Record<string, string[]> = {
    "default-src": ["'self'"],
    // `'unsafe-eval'` só no `next dev` (React Refresh / source maps).
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])],
    // React e o next/font usam style inline; o Tailwind sai num .css do próprio site.
    "style-src": ["'self'", "'unsafe-inline'"],
    // next/font/google baixa as fontes no build e serve de /_next/static.
    "font-src": ["'self'"],
    "img-src": ["'self'", "data:", "blob:"],
    // HMR do `next dev` usa WebSocket.
    "connect-src": ["'self'", ...(dev ? ["ws:", "wss:"] : [])],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "frame-src": ["'none'"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
  };
  // Sem `upgrade-insecure-requests`: quebraria o `next start` local em http,
  // e o HSTS já força https em produção.
  return Object.entries(diretivas)
    .map(([k, v]) => `${k} ${v.join(" ")}`)
    .join("; ");
}

export function cabecalhosSeguranca(dev: boolean): Cabecalho[] {
  return [
    { key: "Content-Security-Policy", value: politicaCsp(dev) },
    // 2 anos; sem `preload` (o domínio ainda é *.up.railway.app).
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    // Redundante com frame-ancestors, para navegadores antigos.
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Isola a janela: página de outro site aberta por link não alcança
    // `window.opener` daqui (e vice-versa).
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), " +
        "serial=(), magnetometer=(), gyroscope=(), accelerometer=(), " +
        "browsing-topics=()",
    },
  ];
}

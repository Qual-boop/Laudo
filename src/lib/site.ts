/**
 * URL pública canônica do site (SEO: metadataBase, sitemap, robots, OG).
 * Vem de NEXT_PUBLIC_APP_URL; ao apontar um domínio próprio, troque só a
 * variável no Railway e faça redeploy.
 */
export const URL_SITE =
  process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "") ||
  "https://laudo-production-9051.up.railway.app";

export const REPOSITORIO = "https://github.com/Qual-boop/Laudo";

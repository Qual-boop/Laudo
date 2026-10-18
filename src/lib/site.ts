/**
 * URL pública canônica do site (SEO: metadataBase, sitemap, robots, OG).
 * Vem de NEXT_PUBLIC_APP_URL; ao apontar um domínio próprio, troque só a
 * variável no Railway e faça redeploy.
 */
export const URL_SITE =
  process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "") ||
  "https://provafix.up.railway.app";

/**
 * Marca. "Provafix" = prova + fix: a prova de que a correção funcionou.
 * Nome inventado de propósito — uma palavra comum ("laudo") nunca ranqueia
 * na busca pelo próprio nome. Identificadores técnicos antigos (o tipo do
 * documento do certificado, que entra no hash) continuam como estão.
 */
export const MARCA = "Provafix";

export const REPOSITORIO = "https://github.com/Qual-boop/Provafix";

export const EMAIL_CONTATO = "eliasmecenasseabra@gmail.com";

/**
 * Código de verificação do Google Search Console (meta google-site-
 * verification). Defina GOOGLE_SITE_VERIFICATION no Railway quando
 * cadastrar o site no Search Console.
 */
export const VERIFICACAO_GOOGLE = process.env.GOOGLE_SITE_VERIFICATION?.trim() || undefined;

import type { MetadataRoute } from "next";
import { URL_SITE } from "@/lib/site";

/**
 * `/c/` (link público do certificado) fica FORA do disallow de propósito:
 * URL bloqueada no robots.txt ainda pode aparecer na busca (só o endereço,
 * com o token), porque o robô nunca lê o `noindex`. Liberado, ele lê o
 * `noindex` (meta da página + X-Robots-Tag em next.config.ts) e não indexa.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/painel", "/perfil", "/certificado/"],
    },
    sitemap: `${URL_SITE}/sitemap.xml`,
    host: URL_SITE,
  };
}

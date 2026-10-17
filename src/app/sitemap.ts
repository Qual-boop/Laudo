import type { MetadataRoute } from "next";
import { URL_SITE } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const agora = new Date();

  return [
    { url: URL_SITE, lastModified: agora, changeFrequency: "weekly", priority: 1 },
    { url: `${URL_SITE}/precos`, lastModified: agora, changeFrequency: "monthly", priority: 0.7 },
    { url: `${URL_SITE}/cadastro`, lastModified: agora, changeFrequency: "yearly", priority: 0.4 },
    { url: `${URL_SITE}/login`, lastModified: agora, changeFrequency: "yearly", priority: 0.2 },
    { url: `${URL_SITE}/termos`, lastModified: agora, changeFrequency: "yearly", priority: 0.2 },
    { url: `${URL_SITE}/privacidade`, lastModified: agora, changeFrequency: "yearly", priority: 0.2 },
  ];
}

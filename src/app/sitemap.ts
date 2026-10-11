import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://laudo.app";
  const agora = new Date();

  return [
    {
      url: base,
      lastModified: agora,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${base}/login`,
      lastModified: agora,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${base}/cadastro`,
      lastModified: agora,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${base}/termos`,
      lastModified: agora,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${base}/privacidade`,
      lastModified: agora,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];
}

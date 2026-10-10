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
      url: `${base}/apresentacao`,
      lastModified: agora,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}

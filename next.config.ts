import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['*.trycloudflare.com'],
  async redirects() {
    return [
      // Rota legada: a landing agora mora em `/`.
      { source: "/apresentacao", destination: "/", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        // Link público do certificado: fora da busca, e o token não vaza no
        // Referer de quem clicar num link a partir dele.
        source: "/c/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

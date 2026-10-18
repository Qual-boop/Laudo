import type { NextConfig } from "next";
import { cabecalhosSeguranca } from "./src/lib/cabecalhos-seguranca";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['*.trycloudflare.com'],
  // Sem `X-Powered-By: Next.js` (fingerprint de graça).
  poweredByHeader: false,
  async redirects() {
    return [
      // Rota legada: a landing agora mora em `/`.
      { source: "/apresentacao", destination: "/", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        // Security headers em tudo (ver lib/cabecalhos-seguranca.ts).
        source: "/:path*",
        headers: cabecalhosSeguranca(process.env.NODE_ENV === "development"),
      },
      {
        // Vem depois do global: na mesma chave, a última regra vence.
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

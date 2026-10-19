import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // bcrypt custo 12 com ~40 arquivos em paralelo numa VM de 2 GB passa
    // dos 5 s padrão de vez em quando (falso negativo, não bug).
    testTimeout: 20_000,
    typecheck: {
      include: ["src/**/*.test-d.ts"],
      tsconfig: "./tsconfig.json",
    },
  },
});

import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { cabecalhosSeguranca, politicaCsp } from "@/lib/cabecalhos-seguranca";

function diretivas(csp: string): Map<string, string[]> {
  return new Map(
    csp.split(";").map((d) => {
      const [nome, ...valores] = d.trim().split(/\s+/);
      return [nome, valores] as const;
    }),
  );
}

describe("politicaCsp", () => {
  it("produção: sem eval, sem origem externa, sem iframe", () => {
    const d = diretivas(politicaCsp(false));
    expect(d.get("default-src")).toEqual(["'self'"]);
    expect(d.get("script-src")).not.toContain("'unsafe-eval'");
    expect(d.get("object-src")).toEqual(["'none'"]);
    expect(d.get("frame-ancestors")).toEqual(["'none'"]);
    expect(d.get("base-uri")).toEqual(["'self'"]);
    expect(d.get("form-action")).toEqual(["'self'"]);
    expect(d.get("connect-src")).toEqual(["'self'"]);
    for (const valores of d.values()) {
      for (const v of valores) expect(v).not.toMatch(/^(https?:|\*)/);
    }
  });

  it("dev: libera eval e WebSocket do HMR", () => {
    const d = diretivas(politicaCsp(true));
    expect(d.get("script-src")).toContain("'unsafe-eval'");
    expect(d.get("connect-src")).toContain("ws:");
  });
});

describe("next.config headers()", () => {
  it("aplica os security headers em todas as rotas", async () => {
    const regras = await nextConfig.headers!();
    const global = regras.find((r) => r.source === "/:path*");
    const chaves = global?.headers.map((h) => h.key);
    expect(chaves).toEqual(
      expect.arrayContaining([
        "Content-Security-Policy",
        "Strict-Transport-Security",
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
        "Permissions-Policy",
      ]),
    );
    expect(global?.headers).toContainEqual({
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    });
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("o /c/ continua noindex + no-referrer e vem depois do global (vence)", async () => {
    const regras = await nextConfig.headers!();
    const iGlobal = regras.findIndex((r) => r.source === "/:path*");
    const iC = regras.findIndex((r) => r.source === "/c/:path*");
    expect(iC).toBeGreaterThan(iGlobal);
    expect(regras[iC].headers).toEqual([
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
      { key: "Referrer-Policy", value: "no-referrer" },
    ]);
  });

  it("todo cabeçalho tem valor", () => {
    for (const h of cabecalhosSeguranca(false)) expect(h.value.length).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from "vitest";
import { verificarOrigem } from "@/lib/origem";

const APP = "https://provafix.up.railway.app";

function h(extra: Record<string, string>): Headers {
  return new Headers({ host: "localhost:8080", ...extra });
}

describe("verificarOrigem (CSRF)", () => {
  it("GET passa sempre", () => {
    expect(verificarOrigem("GET", "/api/v1/relatorios", h({ origin: "https://mal.com" }), APP).permitido).toBe(true);
  });

  it("POST do próprio site (Origin = NEXT_PUBLIC_APP_URL) passa", () => {
    expect(verificarOrigem("POST", "/api/v1/relatorios", h({ origin: APP }), APP).permitido).toBe(true);
  });

  it("POST atrás do proxy: Origin = X-Forwarded-Host passa", () => {
    const r = verificarOrigem(
      "POST",
      "/api/v1/gerar",
      h({ origin: "https://outro-dominio.com.br", "x-forwarded-host": "outro-dominio.com.br", "x-forwarded-proto": "https" }),
      APP,
    );
    expect(r.permitido).toBe(true);
  });

  it("POST de outro site é recusado", () => {
    const r = verificarOrigem("POST", "/api/v1/relatorios", h({ origin: "https://mal.com" }), APP);
    expect(r).toEqual({ permitido: false, motivo: "origem não permitida" });
  });

  it("DELETE sem Origin mas Sec-Fetch-Site cross-site é recusado", () => {
    const r = verificarOrigem("DELETE", "/api/v1/verificacao", h({ "sec-fetch-site": "cross-site" }), APP);
    expect(r.permitido).toBe(false);
  });

  it("app/curl sem Origin nem Sec-Fetch-Site passa (usa Bearer, sem cookie alheio)", () => {
    expect(verificarOrigem("POST", "/api/v1/auth/token", h({}), APP).permitido).toBe(true);
  });

  it("webhook do Asaas é isento", () => {
    expect(
      verificarOrigem("POST", "/api/v1/webhook/asaas", h({ origin: "https://www.asaas.com" }), APP).permitido,
    ).toBe(true);
  });

  it("dev local em http passa", () => {
    const r = verificarOrigem("POST", "/api/v1/gerar", new Headers({ host: "localhost:3000", origin: "http://localhost:3000" }), undefined);
    expect(r.permitido).toBe(true);
  });
});

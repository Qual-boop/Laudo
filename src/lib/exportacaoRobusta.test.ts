import { describe, expect, it } from "vitest";
import {
  LIMITE_URL,
  gerarExportacaoGitHub,
  gerarExportacaoJira,
  urlComLimite,
} from "@/lib/exportacao";
import type { Relatorio } from "@/lib/tipos";

// JSON parcial que o schema de salvamento aceita: achado sem cvss,
// remediação, passos; relatório sem sumário nem recomendações.
const PARCIAL = {
  capa: { titulo: "Teste", cliente: "Acme" },
  achados: [{ titulo: "XSS refletido", severidade: "Alta" }],
  conclusao: "ok",
} as unknown as Relatorio;

describe("exportação Jira/GitHub com relatório parcial", () => {
  it("não quebra sem cvss/remediação/sumário e marca CVSS como N/D", () => {
    const jira = gerarExportacaoJira(PARCIAL);
    const gh = gerarExportacaoGitHub(PARCIAL);
    expect(jira.description).toContain("*CVSS:* N/D");
    expect(gh.body).toContain("**CVSS:** N/D");
    expect(gh.body).toContain("XSS refletido");
    expect(gh.labels).toContain("high");
  });
});

describe("urlComLimite (F8)", () => {
  it("texto curto: URL inteira, sem corte", () => {
    const r = urlComLimite("https://github.com/a/b/issues/new", { title: "t", body: "curto" }, "body");
    expect(r.cortado).toBe(false);
    expect(r.url).toContain("body=curto");
  });

  it("texto enorme: corta só o campo longo, cabe no limite e avisa", () => {
    const enorme = "á".repeat(50_000);
    const r = urlComLimite(
      "https://github.com/a/b/issues/new",
      { title: "Título fica", body: enorme, labels: "pentest" },
      "body",
    );
    expect(r.cortado).toBe(true);
    expect(r.url.length).toBeLessThanOrEqual(LIMITE_URL);
    const params = new URL(r.url).searchParams;
    expect(params.get("title")).toBe("Título fica");
    expect(params.get("labels")).toBe("pentest");
    expect(params.get("body")).toMatch(/texto cortado/);
  });
});

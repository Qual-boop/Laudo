import { describe, expect, it } from "vitest";
import type { AchadoVerificavel } from "@/lib/tipos";
import {
  formatarJSON,
  formatarMarkdown,
  formatarTextoSimples,
} from "@/lib/exportacaoAchado";

const ACHADO_EXEMPLO: AchadoVerificavel = {
  id: 7,
  relatorio_id: 4,
  cliente: "Acme Corp",
  achado_ref: "FINDING-001",
  titulo: "SQL Injection no formulário de login",
  severidade: "Critica",
  cwe: "CWE-89",
  confianca: "Alta",
  data_reteste_sugerida: "2026-10-21",
  status: "verificado",
  criado_em: "2026-10-10 03:19:25",
  ultimo_reteste: {
    id: 5,
    achado_id: 7,
    data_reteste: "2026-10-21",
    resultado: "corrigido",
    evidencia: "POST /login → 400 Bad Request",
    criado_em: "2026-10-10 03:20:00",
  },
  total_retestes: 1,
};

describe("formatarMarkdown", () => {
  it("inclui ref, título, severidade e status", () => {
    const md = formatarMarkdown(ACHADO_EXEMPLO);
    expect(md).toContain("FINDING-001");
    expect(md).toContain("SQL Injection no formulário de login");
    expect(md).toContain("Critica");
    expect(md).toContain("CWE-89");
    expect(md).toContain("Verificado");
  });

  it("inclui o último reteste", () => {
    const md = formatarMarkdown(ACHADO_EXEMPLO);
    expect(md).toContain("2026-10-21");
    expect(md).toContain("POST /login → 400 Bad Request");
  });

  it("funciona sem reteste registrado", () => {
    const md = formatarMarkdown({ ...ACHADO_EXEMPLO, ultimo_reteste: null });
    expect(md).toContain("Sem reteste registrado.");
  });
});

describe("formatarJSON", () => {
  it("gera JSON válido com os campos do achado", () => {
    const json = formatarJSON(ACHADO_EXEMPLO);
    const obj = JSON.parse(json) as Record<string, unknown>;
    expect(obj.ref).toBe("FINDING-001");
    expect(obj.titulo).toBe("SQL Injection no formulário de login");
    expect(obj.status).toBe("verificado");
    expect(obj.ultimo_reteste).toMatchObject({ resultado: "corrigido" });
  });

  it("usa null quando não há reteste nem CWE", () => {
    const json = formatarJSON({
      ...ACHADO_EXEMPLO,
      ultimo_reteste: null,
      cwe: "",
    });
    const obj = JSON.parse(json) as Record<string, unknown>;
    expect(obj.ultimo_reteste).toBeNull();
    expect(obj.cwe).toBeNull();
  });
});

describe("formatarTextoSimples", () => {
  it("gera texto sem sintaxe de markup", () => {
    const txt = formatarTextoSimples(ACHADO_EXEMPLO);
    expect(txt).toContain("FINDING-001: SQL Injection no formulário de login");
    expect(txt).toContain("Status: Verificado");
    expect(txt).not.toContain("h2.");
    expect(txt).not.toContain("**");
  });
});

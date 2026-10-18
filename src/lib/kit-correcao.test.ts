import { describe, expect, it } from "vitest";
import { EscudoPrivacidade } from "@/lib/anonimizacao";
import {
  STACKS,
  comandoReteste,
  ehStack,
  kitEmMarkdown,
  kitLocal,
  montarPromptKit,
  normalizarKit,
  type AchadoParaKit,
} from "@/lib/kit-correcao";

const IDOR: AchadoParaKit = {
  ref: "FINDING-002",
  titulo: "IDOR no endpoint de faturas",
  severidade: "Alta",
  cwe: "CWE-639",
  descricao: "A API não confere o dono da fatura.",
  evidencia: [
    "GET /api/faturas/1043 HTTP/1.1",
    "Host: portal.acme.com.br",
    "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MiJ9.c2lnbmF0dXJhc2VjcmV0YQ",
    "Accept: application/json",
    "",
    "HTTP/1.1 200 OK",
  ].join("\n"),
  passos: ["1. Logar como usuário A", "2. Trocar o ID"],
  remediacao: "Checar propriedade no servidor.",
};

describe("comandoReteste", () => {
  it("monta curl da requisição, trocando credenciais por placeholder", () => {
    const cmd = comandoReteste(IDOR.evidencia)!;
    expect(cmd).toContain("curl -i -s -X GET 'https://portal.acme.com.br/api/faturas/1043'");
    expect(cmd).toContain("-H 'Authorization: <AUTHORIZATION_DO_USUARIO_DE_TESTE>'");
    expect(cmd).toContain("-H 'Accept: application/json'");
    expect(cmd).not.toContain("eyJ");
    expect(cmd).not.toContain("HTTP/1.1 200");
  });

  it("leva o corpo em POST e escapa aspas simples", () => {
    const cmd = comandoReteste(
      "POST /login HTTP/1.1\nHost: app.test\nContent-Type: application/x-www-form-urlencoded\n\nuser=admin' OR '1'='1&senha=x",
    )!;
    expect(cmd).toContain("-X POST 'https://app.test/login'");
    expect(cmd).toContain(`--data-raw 'user=admin'\\'' OR '\\''1'\\''='\\''1&senha=x'`);
  });

  it("aceita URL absoluta e devolve null sem requisição", () => {
    expect(comandoReteste("GET https://api.x.test/v1/users?id=2")).toContain("'https://api.x.test/v1/users?id=2'");
    expect(comandoReteste("Print da tela anexado.")).toBeNull();
  });
});

describe("kit local e normalização", () => {
  it("usa o checklist do CWE e as referências certas", () => {
    const k = kitLocal(IDOR, "node");
    expect(k.origem).toBe("local");
    expect(k.checklist.join(" ")).toMatch(/pertence ao usuário autenticado/);
    expect(k.referencias).toContain("https://cwe.mitre.org/data/definitions/639.html");
    expect(k.referencias[0]).toMatch(/Authorization_Cheat_Sheet/);
    expect(k.reteste.comando).toContain("curl");
  });

  it("CWE desconhecido cai no guia genérico", () => {
    const k = kitLocal({ ...IDOR, cwe: "CWE-9999" }, "go");
    expect(k.checklist.length).toBeGreaterThanOrEqual(3);
    expect(k.referencias[0]).toBe("https://cheatsheetseries.owasp.org/index.html");
  });

  it("aproveita a IA e completa o que faltar com o local", () => {
    const k = normalizarKit(
      {
        resumo: "Cheque o dono da fatura.",
        codigoVulneravel: "```ts\nconst f = await db.fatura(id)\n```",
        codigoCorrigido: "const f = await db.fatura(id, usuario.id)",
        checklist: ["um"], // curto demais: usa o local
        referencias: ["não é url", "https://owasp.org/x"],
        reteste: { descricao: "Repita.", comando: "curl https://inventado" },
      },
      IDOR,
      "node",
    );
    expect(k.origem).toBe("ia");
    expect(k.codigoVulneravel).toBe("const f = await db.fatura(id)");
    expect(k.checklist.length).toBeGreaterThan(1);
    expect(k.referencias).toEqual(["https://owasp.org/x"]);
    // O curl da evidência real vence o da IA.
    expect(k.reteste.comando).toContain("portal.acme.com.br");
    expect(k.causaRaiz).toBe(IDOR.descricao);
  });

  it("exporta Markdown com checklist marcável", () => {
    const md = kitEmMarkdown(kitLocal(IDOR, "python"), IDOR.titulo);
    expect(md).toContain("## FINDING-002 — IDOR no endpoint de faturas");
    expect(md).toContain("- [ ] ");
    expect(md).toContain("```bash");
  });
});

describe("prompt", () => {
  it("cita a stack e o framework de testes", () => {
    const p = montarPromptKit(IDOR, "java");
    expect(p).toContain(STACKS.java.rotulo);
    expect(p).toContain("JUnit 5");
  });

  it("com o escudo, não leva host nem token à IA", () => {
    const escudo = new EscudoPrivacidade(["Acme Pagamentos Ltda."]);
    const p = montarPromptKit(escudo.anonimizar(IDOR), "node");
    expect(p).not.toContain("portal.acme.com.br");
    expect(p).not.toContain("eyJhbGci");
  });

  it("valida stack", () => {
    expect(ehStack("php")).toBe(true);
    expect(ehStack("cobol")).toBe(false);
  });
});

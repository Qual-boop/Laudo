import { describe, expect, it } from "vitest";
import { EscudoPrivacidade, lerResumoProtecao } from "@/lib/anonimizacao";
import { montarPrompt } from "@/lib/relatorio";
import type { RelatorioEntrada } from "@/lib/tipos";

const SENSIVEIS = [
  "Acme Pagamentos Ltda.",
  "portal.acme.com.br",
  "10.20.30.40",
  "dba@acme.com.br",
  "123.456.789-09",
  "12.345.678/0001-95",
  "4111 1111 1111 1111",
  "AKIAABCDEFGHIJKLMNOP",
  "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
  "S3nh4Forte!",
  "abc123sessao",
];

const ENTRADA: RelatorioEntrada = {
  cliente: "Acme Pagamentos Ltda.",
  titulo: "Pentest Web — Acme Pagamentos",
  escopo: "https://portal.acme.com.br e API em 10.20.30.40",
  periodo: "02/10 a 06/10",
  limitacoes: "Contato técnico: dba@acme.com.br",
  ferramentas: "Burp Suite, Nmap",
  achados: [
    {
      titulo: "IDOR em faturas do portal.acme.com.br",
      severidade: "Alta",
      cwe: "CWE-639",
      descricao:
        "Fatura do CPF 123.456.789-09 (CNPJ 12.345.678/0001-95) exposta; cartão 4111 1111 1111 1111 visível.",
      evidencia: [
        "GET /faturas/1043 HTTP/1.1",
        "Host: portal.acme.com.br",
        "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
        "Cookie: session=abc123sessao; theme=dark",
        "Chave vazada no JS: AKIAABCDEFGHIJKLMNOP · password=S3nh4Forte!",
        "Referência: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html",
      ].join("\n"),
      confianca: "Alta",
      dataRetesteSugerida: "2026-10-20",
    },
  ],
};

describe("EscudoPrivacidade", () => {
  it("nenhum dado sensível chega ao prompt da IA", () => {
    const escudo = new EscudoPrivacidade([ENTRADA.cliente]);
    const prompt = montarPrompt(escudo.anonimizar(ENTRADA));
    for (const s of SENSIVEIS) expect(prompt).not.toContain(s);
    expect(prompt).toContain("[[CLIENTE-1]]");
    expect(prompt).toContain("[[HOST-1]]");
  });

  it("restaura exatamente o original (ida e volta)", () => {
    const escudo = new EscudoPrivacidade([ENTRADA.cliente]);
    expect(escudo.restaurar(escudo.anonimizar(ENTRADA))).toEqual(ENTRADA);
  });

  it("mesmo valor vira sempre o mesmo marcador", () => {
    const escudo = new EscudoPrivacidade();
    const t = escudo.anonimizarTexto("10.0.0.5 e de novo 10.0.0.5, depois 10.0.0.6");
    expect(t).toBe("[[IP-1]] e de novo [[IP-1]], depois [[IP-2]]");
  });

  it("preserva referências públicas, CWE, CVSS e enums", () => {
    const escudo = new EscudoPrivacidade();
    const texto =
      "Ver https://owasp.org/Top10 e cwe.mitre.org — CVSS:3.1/AV:N/AC:L, reteste-403.png, 127.0.0.1";
    expect(escudo.anonimizarTexto(texto)).toBe(texto);
    const p = escudo.anonimizar(ENTRADA.achados[0]);
    expect(p.cwe).toBe("CWE-639");
    expect(p.severidade).toBe("Alta");
    expect(p.dataRetesteSugerida).toBe("2026-10-20");
  });

  it("mascara o cliente com e sem sufixo societário", () => {
    const escudo = new EscudoPrivacidade(["Acme Pagamentos Ltda."]);
    expect(escudo.anonimizarTexto("A Acme Pagamentos aprovou; Acme Pagamentos Ltda. assinou.")).toBe(
      "A [[CLIENTE-1]] aprovou; [[CLIENTE-2]] assinou.",
    );
  });

  it("restaura marcadores que a IA devolveu com espaço ou colchete simples", () => {
    const escudo = new EscudoPrivacidade();
    escudo.anonimizarTexto("alvo 192.168.1.10");
    expect(escudo.restaurarTexto("em [[ IP-1 ]] e [IP-1]; [[IP-9]] fica")).toBe(
      "em 192.168.1.10 e 192.168.1.10; [[IP-9]] fica",
    );
  });

  it("não marca número aleatório como cartão (Luhn)", () => {
    const escudo = new EscudoPrivacidade();
    expect(escudo.anonimizarTexto("pedido 4111 1111 1111 1112")).toBe("pedido 4111 1111 1111 1112");
  });

  it("resume e serializa o que foi protegido", () => {
    const escudo = new EscudoPrivacidade([ENTRADA.cliente]);
    escudo.anonimizar(ENTRADA);
    const cab = escudo.cabecalho();
    expect(cab).toMatch(/^[A-Z]+=\d+(;[A-Z]+=\d+)*$/);
    const lido = lerResumoProtecao(cab);
    const ip = lido.find((r) => r.tipo === "IP");
    expect(ip?.quantidade).toBe(1);
    expect(lido.map((r) => r.tipo)).toEqual(
      expect.arrayContaining(["CLIENTE", "HOST", "EMAIL", "CPF", "CNPJ", "CARTAO", "SEGREDO", "TOKEN"]),
    );
    expect(lerResumoProtecao("X=1;IP=abc")).toEqual([]);
  });
});

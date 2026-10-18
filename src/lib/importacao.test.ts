import { describe, expect, it } from "vitest";
import {
  ErroImportacao,
  LIMITE_ACHADOS,
  detectarFormato,
  importarScanner,
  limparHtml,
} from "@/lib/importacao";

const NESSUS = `<?xml version="1.0" ?>
<NessusClientData_v2>
<Report name="acme">
<ReportHost name="10.0.0.5">
  <ReportItem port="443" svc_name="www" protocol="tcp" severity="2" pluginID="42873" pluginName="SSL Medium Strength Cipher Suites Supported (SWEET32)">
    <description>The remote host supports the use of SSL ciphers that offer medium strength encryption.</description>
    <solution>Reconfigure the affected application if possible to avoid use of medium strength ciphers.</solution>
    <cwe>326</cwe>
    <plugin_output>Medium Strength Ciphers: DES-CBC3-SHA</plugin_output>
  </ReportItem>
  <ReportItem port="0" svc_name="general" protocol="tcp" severity="0" pluginID="19506" pluginName="Nessus Scan Information">
    <description>Information about this scan.</description>
  </ReportItem>
  <ReportItem port="22" svc_name="ssh" protocol="tcp" severity="4" pluginID="201194" pluginName="OpenSSH &lt; 9.8 RCE (regreSSHion)">
    <description>&lt;p&gt;Remote unauthenticated code execution.&lt;/p&gt;</description>
    <solution>Upgrade to OpenSSH 9.8 or later.</solution>
  </ReportItem>
</ReportHost>
<ReportHost name="10.0.0.6">
  <ReportItem port="443" svc_name="www" protocol="tcp" severity="2" pluginID="42873" pluginName="SSL Medium Strength Cipher Suites Supported (SWEET32)">
    <description>The remote host supports the use of SSL ciphers that offer medium strength encryption.</description>
    <cwe>326</cwe>
  </ReportItem>
</ReportHost>
</Report>
</NessusClientData_v2>`;

const BURP = `<?xml version="1.0"?>
<!DOCTYPE issues [
<!ELEMENT issues (issue*)>
<!ATTLIST issues burpVersion CDATA "">
<!ELEMENT host (#PCDATA)>
<!ATTLIST host ip CDATA "">
]>
<issues burpVersion="2026.9">
  <issue>
    <serialNumber>1</serialNumber>
    <type>1049088</type>
    <name>SQL injection</name>
    <host ip="10.0.0.7">https://portal.acme.com.br</host>
    <path><![CDATA[/login]]></path>
    <location><![CDATA[/login [username parameter]]]></location>
    <severity>High</severity>
    <confidence>Certain</confidence>
    <issueBackground><![CDATA[<p>SQL injection vulnerabilities arise when user-controllable data is incorporated into database SQL queries.</p>]]></issueBackground>
    <remediationBackground><![CDATA[<p>Use parameterized queries.</p>]]></remediationBackground>
    <vulnerabilityClassifications><![CDATA[<ul><li><a href="https://cwe.mitre.org/data/definitions/89.html">CWE-89: SQL Injection</a></li></ul>]]></vulnerabilityClassifications>
    <issueDetail><![CDATA[The <b>username</b> parameter appears to be vulnerable.]]></issueDetail>
  </issue>
  <issue>
    <type>1049088</type>
    <name>SQL injection</name>
    <host ip="10.0.0.7">https://portal.acme.com.br</host>
    <path>/busca</path>
    <severity>High</severity>
    <confidence>Firm</confidence>
  </issue>
  <issue>
    <type>5245344</type>
    <name>Frameable response (potential Clickjacking)</name>
    <host ip="10.0.0.7">https://portal.acme.com.br</host>
    <path>/</path>
    <severity>Information</severity>
    <confidence>Firm</confidence>
  </issue>
</issues>`;

const ZAP_JSON = JSON.stringify({
  "@programName": "ZAP",
  site: [
    {
      "@name": "https://portal.acme.com.br",
      alerts: [
        {
          pluginid: "10038",
          alert: "Content Security Policy (CSP) Header Not Set",
          name: "Content Security Policy (CSP) Header Not Set",
          riskcode: "2",
          confidence: "3",
          desc: "<p>CSP is an added layer of security.</p>",
          instances: [
            { uri: "https://portal.acme.com.br/", method: "GET", param: "", evidence: "" },
            { uri: "https://portal.acme.com.br/login", method: "GET", param: "", evidence: "" },
          ],
          solution: "<p>Set the Content-Security-Policy header.</p>",
          cweid: "693",
        },
        {
          pluginid: "10027",
          alert: "Information Disclosure - Suspicious Comments",
          name: "Information Disclosure - Suspicious Comments",
          riskcode: "0",
          confidence: "1",
          instances: [],
          cweid: "200",
        },
      ],
    },
  ],
});

const ZAP_XML = `<?xml version="1.0"?>
<OWASPZAPReport programName="ZAP" version="2.16.0">
<site name="https://api.acme.com.br" host="api.acme.com.br" port="443" ssl="true">
<alerts>
  <alertitem>
    <pluginid>40018</pluginid>
    <alert>SQL Injection</alert>
    <name>SQL Injection</name>
    <riskcode>3</riskcode>
    <confidence>2</confidence>
    <desc>&lt;p&gt;SQL injection may be possible.&lt;/p&gt;</desc>
    <instances>
      <instance><uri>https://api.acme.com.br/v1/users?id=1</uri><method>GET</method><param>id</param><evidence>syntax error</evidence></instance>
    </instances>
    <solution>&lt;p&gt;Use prepared statements.&lt;/p&gt;</solution>
    <cweid>89</cweid>
  </alertitem>
</alerts>
</site>
</OWASPZAPReport>`;

describe("detectarFormato", () => {
  it("reconhece os três scanners e recusa o resto", () => {
    expect(detectarFormato(NESSUS)).toBe("nessus");
    expect(detectarFormato(BURP)).toBe("burp");
    expect(detectarFormato(ZAP_JSON)).toBe("zap");
    expect(detectarFormato(ZAP_XML)).toBe("zap");
    expect(detectarFormato("<html></html>")).toBeNull();
    expect(detectarFormato('{"foo": 1}')).toBeNull();
  });
});

describe("Nessus", () => {
  const r = importarScanner(NESSUS);

  it("agrupa o mesmo plugin em vários hosts e ordena por severidade", () => {
    expect(r.formato).toBe("nessus");
    expect(r.achados.map((a) => a.titulo)).toEqual([
      "OpenSSH < 9.8 RCE (regreSSHion)",
      "SSL Medium Strength Cipher Suites Supported (SWEET32)",
    ]);
    expect(r.ocorrencias).toBe(3);
    expect(r.informativosIgnorados).toBe(1);
    const sweet = r.achados[1];
    expect(sweet.severidade).toBe("Media");
    expect(sweet.cwe).toBe("CWE-326");
    expect(sweet.evidencia).toContain("Afeta 2 locais");
    expect(sweet.evidencia).toContain("10.0.0.5:443/tcp");
    expect(sweet.evidencia).toContain("10.0.0.6:443/tcp");
    expect(sweet.descricao).toContain("Correção sugerida pelo scanner");
  });

  it("mapeia crítica, limpa HTML e marca confiança média", () => {
    const rce = r.achados[0];
    expect(rce.severidade).toBe("Critica");
    expect(rce.descricao).toContain("Remote unauthenticated code execution.");
    expect(rce.descricao).not.toContain("<p>");
    expect(rce.confianca).toBe("Media");
    expect(rce.dataRetesteSugerida).toBe("");
  });
});

describe("Burp Suite", () => {
  const r = importarScanner(BURP);

  it("agrupa por tipo, ignora informativo e lê CWE das classificações", () => {
    expect(r.formato).toBe("burp");
    expect(r.achados).toHaveLength(1);
    const sqli = r.achados[0];
    expect(sqli.titulo).toBe("SQL injection");
    expect(sqli.severidade).toBe("Alta");
    expect(sqli.cwe).toBe("CWE-89");
    expect(sqli.confianca).toBe("Alta"); // a maior entre Certain e Firm
    expect(sqli.evidencia).toContain("https://portal.acme.com.br/login");
    expect(sqli.evidencia).toContain("https://portal.acme.com.br/busca");
    expect(sqli.descricao).toContain("parameterized queries");
    expect(r.informativosIgnorados).toBe(1);
  });
});

describe("OWASP ZAP", () => {
  it("lê o relatório JSON", () => {
    const r = importarScanner(ZAP_JSON);
    expect(r.achados).toHaveLength(1);
    const csp = r.achados[0];
    expect(csp.severidade).toBe("Media");
    expect(csp.confianca).toBe("Alta");
    expect(csp.cwe).toBe("CWE-693");
    expect(csp.evidencia).toContain("GET https://portal.acme.com.br/login");
    expect(r.ocorrencias).toBe(2);
    expect(r.informativosIgnorados).toBe(1);
  });

  it("lê o relatório XML", () => {
    const r = importarScanner(ZAP_XML);
    const sqli = r.achados[0];
    expect(sqli.severidade).toBe("Alta");
    expect(sqli.cwe).toBe("CWE-89");
    expect(sqli.confianca).toBe("Media");
    expect(sqli.evidencia).toContain("[parâmetro: id]");
    expect(sqli.evidencia).toContain("syntax error");
    expect(sqli.descricao).toContain("SQL injection may be possible.");
  });
});

const SARIF_SEMGREP = JSON.stringify({
  $schema: "https://json.schemastore.org/sarif-2.1.0.json",
  version: "2.1.0",
  runs: [
    {
      tool: {
        driver: {
          name: "Semgrep OSS",
          rules: [
            {
              id: "python.django.security.injection.sql.sql-injection-db-cursor-execute",
              name: "sql-injection-db-cursor-execute",
              shortDescription: { text: "SQL montado com entrada do usuário em cursor.execute" },
              fullDescription: { text: "User-controlled data flows into a raw SQL query." },
              help: { text: "Use parameterized queries." },
              defaultConfiguration: { level: "error" },
              properties: { precision: "high", tags: ["CWE-89: Improper Neutralization of Special Elements used in an SQL Command", "security"] },
            },
          ],
        },
      },
      results: [
        {
          ruleId: "python.django.security.injection.sql.sql-injection-db-cursor-execute",
          level: "error",
          message: { text: "Detected user input in raw SQL." },
          locations: [{ physicalLocation: { artifactLocation: { uri: "app/views.py" }, region: { startLine: 42 } } }],
        },
        {
          ruleId: "python.django.security.injection.sql.sql-injection-db-cursor-execute",
          level: "error",
          message: { text: "Detected user input in raw SQL." },
          locations: [{ physicalLocation: { artifactLocation: { uri: "app/relatorios.py" }, region: { startLine: 7 } } }],
        },
        {
          ruleId: "estilo",
          level: "none",
          message: { text: "informativo" },
        },
      ],
    },
  ],
});

const SARIF_CODEQL = JSON.stringify({
  version: "2.1.0",
  runs: [
    {
      tool: {
        driver: {
          name: "CodeQL",
          rules: [
            {
              id: "js/path-injection",
              shortDescription: { text: "Uncontrolled data used in path expression" },
              properties: {
                "security-severity": "9.3",
                precision: "very-high",
                tags: ["security", "external/cwe/cwe-022", "external/cwe/cwe-023"],
              },
            },
          ],
        },
      },
      results: [
        {
          ruleId: "js/path-injection",
          message: { text: "This path depends on a user-provided value." },
          locations: [{ physicalLocation: { artifactLocation: { uri: "src/arquivos.ts" }, region: { startLine: 18 } } }],
        },
      ],
    },
  ],
});

describe("SARIF (análise de código)", () => {
  it("detecta SARIF sem confundir com ZAP", () => {
    expect(detectarFormato(SARIF_SEMGREP)).toBe("sarif");
    expect(detectarFormato(SARIF_CODEQL)).toBe("sarif");
    expect(detectarFormato(ZAP_JSON)).toBe("zap");
  });

  it("Semgrep: agrupa por regra, arquivo:linha como local, CWE das tags", () => {
    const r = importarScanner(SARIF_SEMGREP);
    expect(r.achados).toHaveLength(1);
    const a = r.achados[0];
    expect(a.titulo).toBe("SQL montado com entrada do usuário em cursor.execute");
    expect(a.severidade).toBe("Alta");
    expect(a.cwe).toBe("CWE-89");
    expect(a.confianca).toBe("Alta");
    expect(a.evidencia).toContain("app/views.py:42");
    expect(a.evidencia).toContain("app/relatorios.py:7");
    expect(a.evidencia).toContain("Semgrep OSS");
    expect(a.descricao).toContain("Use parameterized queries.");
    expect(r.informativosIgnorados).toBe(1);
  });

  it("CodeQL: security-severity vira severidade e cwe-022 vira CWE-22", () => {
    const a = importarScanner(SARIF_CODEQL).achados[0];
    expect(a.severidade).toBe("Critica");
    expect(a.cwe).toBe("CWE-22");
    expect(a.confianca).toBe("Alta");
    expect(a.evidencia).toContain("src/arquivos.ts:18");
  });
});

describe("limites e segurança", () => {
  it("corta em LIMITE_ACHADOS grupos, mantendo os mais graves", () => {
    const itens = Array.from(
      { length: LIMITE_ACHADOS + 10 },
      (_, i) =>
        `<ReportItem port="80" protocol="tcp" severity="${i < 5 ? 4 : 1}" pluginID="${i}" pluginName="P${i}"><description>d</description></ReportItem>`,
    ).join("");
    const r = importarScanner(
      `<NessusClientData_v2><Report><ReportHost name="h">${itens}</ReportHost></Report></NessusClientData_v2>`,
    );
    expect(r.achados).toHaveLength(LIMITE_ACHADOS);
    expect(r.truncado).toBe(true);
    expect(r.achados.slice(0, 5).every((a) => a.severidade === "Critica")).toBe(true);
  });

  it("não expande entidades internas (billion laughs)", () => {
    const bomba = `<?xml version="1.0"?>
<!DOCTYPE r [<!ENTITY a "AAAAAAAAAA"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">]>
<NessusClientData_v2><Report><ReportHost name="h">
<ReportItem port="1" protocol="tcp" severity="3" pluginID="1" pluginName="&b;"><description>&b;</description></ReportItem>
</ReportHost></Report></NessusClientData_v2>`;
    const r = importarScanner(bomba);
    expect(r.achados[0].titulo).not.toContain("AAAAAAAAAA");
    expect(r.achados[0].descricao).not.toContain("AAAAAAAAAA");
  });

  it("recusa entidade externa (XXE lendo arquivo do servidor)", () => {
    const xxe = `<?xml version="1.0"?>
<!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]>
<NessusClientData_v2><Report><ReportHost name="h">
<ReportItem port="1" protocol="tcp" severity="3" pluginID="1" pluginName="P"><description>&x;</description></ReportItem>
</ReportHost></Report></NessusClientData_v2>`;
    expect(() => importarScanner(xxe)).toThrow(ErroImportacao);
  });

  it("explica quando o formato não é suportado", () => {
    expect(() => importarScanner("nmap output")).toThrow(ErroImportacao);
  });

  it("limparHtml transforma listas e quebras em texto", () => {
    expect(limparHtml("<ul><li>um</li><li>dois &amp; três</li></ul>")).toBe("- um\n- dois & três");
  });
});

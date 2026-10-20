import { describe, expect, it } from "vitest";
import { detectarFormato, importarScanner } from "@/lib/importacao";

const NUCLEI_JSONL = [
  JSON.stringify({
    "template-id": "git-config",
    info: {
      name: "Git Config Exposure",
      severity: "medium",
      description: "Arquivo .git/config acessível.",
      remediation: "Bloqueie /.git no servidor web.",
      reference: ["https://example.com/git"],
      classification: { "cwe-id": ["cwe-538"] },
    },
    host: "https://a.exemplo.com",
    "matched-at": "https://a.exemplo.com/.git/config",
  }),
  JSON.stringify({
    "template-id": "git-config",
    info: { name: "Git Config Exposure", severity: "medium" },
    "matched-at": "https://b.exemplo.com/.git/config",
  }),
  JSON.stringify({
    "template-id": "tech-detect",
    info: { name: "Tech Detect", severity: "info" },
    "matched-at": "https://a.exemplo.com",
  }),
  JSON.stringify({
    "template-id": "CVE-2021-44228",
    info: { name: "Log4Shell", severity: "critical", classification: { "cwe-id": ["cwe-502"] } },
    "matched-at": "https://c.exemplo.com/api",
    "extracted-results": ["jndi:ldap callback"],
  }),
].join("\n");

const OPENVAS_XML = `<?xml version="1.0"?>
<report id="r1" format_id="x">
  <report id="r1">
    <results>
      <result id="1">
        <name>SSL/TLS: Deprecated TLSv1.0</name>
        <host>10.0.0.5</host>
        <port>443/tcp</port>
        <nvt oid="1.3.6.1.4.1.25623.1.0.117274">
          <name>SSL/TLS: Deprecated TLSv1.0 and TLSv1.1 Protocol Detection</name>
          <tags>cvss_base_vector=AV:N|summary=O servidor aceita TLS 1.0.|impact=Ataques de downgrade.|solution=Desative TLS 1.0 e 1.1.</tags>
          <refs><ref type="cwe" id="CWE-326"/></refs>
        </nvt>
        <threat>Medium</threat>
        <severity>5.9</severity>
        <description>Protocolos aceitos: TLSv1.0</description>
      </result>
      <result id="2">
        <name>OS Detection</name>
        <host>10.0.0.5</host>
        <port>general/tcp</port>
        <nvt oid="1.3.6.1.4.1.25623.1.0.105937"><name>OS Detection Consolidation</name></nvt>
        <threat>Log</threat>
        <severity>0.0</severity>
      </result>
      <result id="3">
        <name>SSL/TLS: Deprecated TLSv1.0</name>
        <host>10.0.0.9</host>
        <port>8443/tcp</port>
        <nvt oid="1.3.6.1.4.1.25623.1.0.117274"><name>SSL/TLS: Deprecated TLSv1.0 and TLSv1.1 Protocol Detection</name></nvt>
        <threat>Medium</threat>
        <severity>5.9</severity>
      </result>
    </results>
  </report>
</report>`;

describe("importação Nuclei", () => {
  it("detecta JSONL e array JSON", () => {
    expect(detectarFormato(NUCLEI_JSONL)).toBe("nuclei");
    expect(detectarFormato(`[${NUCLEI_JSONL.split("\n").join(",")}]`)).toBe("nuclei");
  });

  it("agrupa por template, descarta info e ordena por severidade", () => {
    const r = importarScanner(NUCLEI_JSONL);
    expect(r.formato).toBe("nuclei");
    expect(r.informativosIgnorados).toBe(1);
    expect(r.ocorrencias).toBe(3);
    expect(r.achados.map((a) => a.titulo)).toEqual(["Log4Shell", "Git Config Exposure"]);
    const git = r.achados[1];
    expect(git.severidade).toBe("Media");
    expect(git.cwe).toBe("CWE-538");
    expect(git.evidencia).toContain("Afeta 2 locais");
    expect(git.descricao).toContain("Bloqueie /.git");
    expect(r.achados[0].evidencia).toContain("jndi:ldap callback");
  });
});

describe("importação OpenVAS/Greenbone", () => {
  it("detecta o XML exportado do GSA", () => {
    expect(detectarFormato(OPENVAS_XML)).toBe("openvas");
  });

  it("agrupa por NVT, ignora Log e lê CWE/solução das tags", () => {
    const r = importarScanner(OPENVAS_XML);
    expect(r.formato).toBe("openvas");
    expect(r.informativosIgnorados).toBe(1);
    expect(r.achados).toHaveLength(1);
    const a = r.achados[0];
    expect(a.severidade).toBe("Media");
    expect(a.cwe).toBe("CWE-326");
    expect(a.descricao).toContain("TLS 1.0");
    expect(a.descricao).toContain("Desative TLS 1.0 e 1.1");
    expect(a.evidencia).toContain("10.0.0.5:443/tcp");
    expect(a.evidencia).toContain("10.0.0.9:8443/tcp");
  });

  it("recusa entidade externa (XXE) também no OpenVAS", () => {
    const xxe = `<?xml version="1.0"?><!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]>${OPENVAS_XML.replace('<?xml version="1.0"?>', "").replace("<name>OS Detection</name>", "<name>&x;</name>")}`;
    expect(() => importarScanner(xxe)).toThrow();
  });
});

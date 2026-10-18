import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const USUARIO = {
  id: 0,
  nome: "QA Link API",
  email: "qa.link-api@laudo-teste.com",
  plano: "pro" as "free" | "pro" | "team",
};

vi.mock("@/lib/api-auth", () => ({
  exigirUsuario: vi.fn(async () => ({ ok: true, usuario: { ...USUARIO } })),
  erroApi: (error: string, code: string, status: number) =>
    Response.json({ error, code }, { status }),
}));

import db from "@/lib/db";
import { DELETE, POST } from "@/app/api/v1/certificado/[id]/link/route";
import { GET as baixarJson } from "@/app/c/[token]/json/route";
import { carregarDadosCertificado } from "@/lib/certificado-dados";
import { criarUsuario, definirPlano } from "@/lib/usuarios";

function limpar() {
  db.prepare("DELETE FROM usuarios WHERE email = ?").run(USUARIO.email);
  USUARIO.id = 0;
  USUARIO.plano = "pro";
}

async function semear(): Promise<number> {
  limpar();
  const u = (await criarUsuario(USUARIO.nome, USUARIO.email, "senha-123456"))!;
  await definirPlano(u.id, "pro");
  USUARIO.id = u.id;

  const rel = db
    .prepare(
      `INSERT INTO relatorios (cliente, titulo, data, versao, risco_geral,
         total_achados, relatorio_json, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run("Cliente Ação", "Pentest web — portal", "2026-10-01", "2.1", "Alta", 1, "{}", u.id);
  const relatorioId = Number(rel.lastInsertRowid);
  const achado = db
    .prepare(
      `INSERT INTO achados_verificacao (relatorio_id, achado_ref, titulo, severidade, status)
       VALUES (?, ?, ?, ?, 'verificado')`,
    )
    .run(relatorioId, "FINDING-001", "XSS refletido na busca", "Alta");
  db.prepare(
    "INSERT INTO retestes (achado_id, data_reteste, resultado) VALUES (?, ?, 'corrigido')",
  ).run(Number(achado.lastInsertRowid), "2026-10-12");
  return relatorioId;
}

function ctxId(id: number) {
  return { params: Promise.resolve({ id: String(id) }) };
}

function ctxToken(token: string) {
  return { params: Promise.resolve({ token }) };
}

function req(metodo: string, id: number) {
  return new Request(`http://localhost/api/v1/certificado/${id}/link`, { method: metodo });
}

afterEach(limpar);

describe("/api/v1/certificado/[id]/link + /c/[token]/json", () => {
  it("cria o link e o JSON público tem o mesmo hash do certificado", async () => {
    const id = await semear();
    const res = await POST(req("POST", id), ctxId(id));
    expect(res.status).toBe(200);
    const { token, caminho } = (await res.json()) as { token: string; caminho: string };
    expect(caminho).toBe(`/c/${token}`);

    const json = await baixarJson(new Request(`http://localhost/c/${token}/json`), ctxToken(token));
    expect(json.status).toBe(200);
    expect(json.headers.get("content-type")).toContain("application/json");
    expect(json.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(json.headers.get("cache-control")).toBe("no-store");

    // `curl -s .../json | sha256sum` precisa bater com o hash da página.
    const bytes = Buffer.from(await json.arrayBuffer());
    const hash = createHash("sha256").update(bytes).digest("hex");
    expect(hash).toBe((await carregarDadosCertificado(id))!.hash);
    expect(bytes.toString("utf8")).toContain("Cliente Ação");
    expect(bytes.toString("utf8")).not.toContain(USUARIO.email);
  });

  it("revogar derruba o link público", async () => {
    const id = await semear();
    const { token } = (await (await POST(req("POST", id), ctxId(id))).json()) as {
      token: string;
    };

    const revogado = await DELETE(req("DELETE", id), ctxId(id));
    expect(revogado.status).toBe(200);

    const json = await baixarJson(new Request(`http://localhost/c/${token}/json`), ctxToken(token));
    expect(json.status).toBe(404);

    const novo = (await (await POST(req("POST", id), ctxId(id))).json()) as { token: string };
    expect(novo.token).not.toBe(token);
  });

  it("outro usuário não cria nem revoga (403); free recebe 402", async () => {
    const id = await semear();
    const dono = USUARIO.id;

    USUARIO.plano = "free";
    const free = await POST(req("POST", id), ctxId(id));
    expect(free.status).toBe(402);
    expect(((await free.json()) as { code: string }).code).toBe("LIMITE_PLANO");

    USUARIO.plano = "pro";
    USUARIO.id = dono + 999;
    expect((await POST(req("POST", id), ctxId(id))).status).toBe(403);
    expect((await DELETE(req("DELETE", id), ctxId(id))).status).toBe(403);
    USUARIO.id = dono;
  });

  it("certificado pendente não ganha link (409)", async () => {
    const id = await semear();
    db.prepare("UPDATE achados_verificacao SET status = 'pendente' WHERE relatorio_id = ?").run(id);
    const res = await POST(req("POST", id), ctxId(id));
    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe("CERTIFICADO_PENDENTE");
  });

  it("token inexistente dá 404 sem dizer por quê", async () => {
    const res = await baixarJson(
      new Request("http://localhost/c/x/json"),
      ctxToken("A".repeat(43)),
    );
    expect(res.status).toBe(404);
    expect(((await res.json()) as { code: string }).code).toBe("NAO_ENCONTRADO");
  });
});

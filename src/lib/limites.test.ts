import { afterAll, afterEach, describe, expect, it } from "vitest";
import db from "@/lib/db";
import {
  consumirUso,
  devolverUso,
  incrementarUso,
  lerUso,
  respostaLimite,
  mesAtual,
  normalizarPlano,
  obterUso,
  resetarUsoMensal,
  verificarLimite,
  LIMITES,
} from "@/lib/limites";
import { criarUsuario } from "@/lib/usuarios";

const EMAIL = "qa.limites@laudo-teste.com";
let usuarioId = 0;

async function garantirUsuario(): Promise<number> {
  if (usuarioId) return usuarioId;
  // Hermético contra linhas órfãs de runs interrompidos: recria do zero.
  db.prepare("DELETE FROM usuarios WHERE email = ?").run(EMAIL);
  const u = (await criarUsuario("QA Limites", EMAIL, "senha-123456"))!;
  usuarioId = u.id;
  db.prepare("DELETE FROM uso_mensal WHERE usuario_id = ?").run(usuarioId);
  return usuarioId;
}

afterEach(() => {
  if (usuarioId) {
    db.prepare("DELETE FROM uso_mensal WHERE usuario_id = ?").run(usuarioId);
  }
});

afterAll(() => {
  db.prepare("DELETE FROM usuarios WHERE email = ?").run(EMAIL);
  usuarioId = 0;
});

describe("limites", () => {
  it("free tem 3 relatórios, 5 achados e 10 retestes; pro 300 e team 900 relatórios", () => {
    expect(LIMITES.free.relatoriosMes).toBe(3);
    expect(LIMITES.free.achadosPorRelatorio).toBe(5);
    expect(LIMITES.free.retestesMes).toBe(10);
    expect(LIMITES.free.exportacaoAvancada).toBe(false);
    expect(LIMITES.free.certificado).toBe(false);
    expect(LIMITES.pro.relatoriosMes).toBe(300);
    expect(LIMITES.team.relatoriosMes).toBe(900);
    expect(LIMITES.pro.retestesMes).toBe(Infinity);
    expect(LIMITES.pro.exportacaoAvancada).toBe(true);
    // Gerações com IA: folga de 2x sobre os relatórios em todo plano.
    for (const p of ["free", "pro", "team"] as const) {
      expect(LIMITES[p].geracoesIaMes).toBe(2 * LIMITES[p].relatoriosMes);
    }
  });

  it("consumirUso é atômico: 5 consumos simultâneos no free param em 3", async () => {
    const id = await garantirUsuario();
    const r = await Promise.all(
      Array.from({ length: 5 }, () => consumirUso(id, "free", "relatorios")),
    );
    expect(r.filter((v) => v.permitido)).toHaveLength(3);
    expect((await lerUso(id)).relatorios_criados).toBe(3);
  });

  it("devolverUso desfaz um consumo e nunca fica negativo", async () => {
    const id = await garantirUsuario();
    await consumirUso(id, "pro", "geracoes");
    await devolverUso(id, "geracoes");
    await devolverUso(id, "geracoes");
    expect((await lerUso(id)).geracoes_ia).toBe(0);
  });

  it("mesAtual usa o fuso de Brasília (virada à meia-noite BRT, não UTC)", () => {
    // 31/10 22h em Brasília = 01/11 01h UTC: ainda é outubro para o usuário.
    expect(mesAtual(new Date("2026-11-01T01:00:00Z"))).toBe("2026-10");
    expect(mesAtual(new Date("2026-11-01T03:00:00Z"))).toBe("2026-11");
  });

  it("respostaLimite: 402 com plano e texto próprio de cada plano", async () => {
    const v = { permitido: false, usados: 300, limite: 300, recurso: "relatorios" as const };
    const res = respostaLimite(v, "pro");
    expect(res.status).toBe(402);
    const corpo = (await res.json()) as Record<string, unknown>;
    expect(corpo).toMatchObject({ code: "LIMITE_PLANO", plano: "pro", usados: 300, limite: 300 });
    expect(String(corpo.error)).toMatch(/300\/300 relatórios.*Team/);
  });

  it("normalizarPlano trata valores estranhos como free", () => {
    expect(normalizarPlano("pro")).toBe("pro");
    expect(normalizarPlano("team")).toBe("team");
    expect(normalizarPlano("enterprise")).toBe("free");
    expect(normalizarPlano(null)).toBe("free");
  });

  it("bloqueia o 4º relatório no free e libera no pro", async () => {
    const id = await garantirUsuario();
    for (let i = 0; i < 3; i++) await incrementarUso(id, "relatorios_criados");
    const uso = await obterUso(id);
    expect(uso.relatorios_criados).toBe(3);
    const free = verificarLimite("free", uso, "relatorios");
    expect(free.permitido).toBe(false);
    expect(free.usados).toBe(3);
    expect(free.limite).toBe(3);
    expect(verificarLimite("pro", uso, "relatorios").permitido).toBe(true);
  });

  it("bloqueia o 11º reteste no free", async () => {
    const id = await garantirUsuario();
    for (let i = 0; i < 10; i++) await incrementarUso(id, "retestes_registrados");
    const v = verificarLimite("free", await obterUso(id), "retestes");
    expect(v.permitido).toBe(false);
    expect(v.limite).toBe(10);
  });

  it("mês novo começa zerado (reset automático)", async () => {
    const id = await garantirUsuario();
    await incrementarUso(id, "relatorios_criados", "2026-01");
    expect((await obterUso(id, "2026-01")).relatorios_criados).toBe(1);
    expect((await obterUso(id, mesAtual())).relatorios_criados).toBe(0);
    expect(await resetarUsoMensal()).toBeGreaterThanOrEqual(1);
    expect((await obterUso(id, "2026-01")).relatorios_criados).toBe(0);
  });

  it("lerUso lê sem criar linha (checagem que não consome)", async () => {
    const id = await garantirUsuario();
    // Sem nenhum uso: zeros e nenhuma linha criada.
    expect(await lerUso(id)).toEqual({
      relatorios_criados: 0,
      retestes_registrados: 0,
      geracoes_ia: 0,
    });
    const linhas = db
      .prepare("SELECT COUNT(*) AS n FROM uso_mensal WHERE usuario_id = ?")
      .get(id) as { n: number };
    expect(linhas.n).toBe(0);
    // Com uso existente: reflete sem duplicar.
    await incrementarUso(id, "relatorios_criados");
    expect((await lerUso(id)).relatorios_criados).toBe(1);
  });
});

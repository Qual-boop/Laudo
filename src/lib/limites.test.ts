import { afterAll, afterEach, describe, expect, it } from "vitest";
import db from "@/lib/db";
import {
  incrementarUso,
  lerUso,
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
  it("free tem 3 relatórios, 5 achados e 10 retestes; pro é ilimitado", () => {
    expect(LIMITES.free.relatoriosMes).toBe(3);
    expect(LIMITES.free.achadosPorRelatorio).toBe(5);
    expect(LIMITES.free.retestesMes).toBe(10);
    expect(LIMITES.free.exportacaoAvancada).toBe(false);
    expect(LIMITES.free.certificado).toBe(false);
    expect(LIMITES.pro.relatoriosMes).toBe(Infinity);
    expect(LIMITES.pro.exportacaoAvancada).toBe(true);
  });

  it("normalizarPlano trata valores estranhos como free", () => {
    expect(normalizarPlano("pro")).toBe("pro");
    expect(normalizarPlano("team")).toBe("team");
    expect(normalizarPlano("enterprise")).toBe("free");
    expect(normalizarPlano(null)).toBe("free");
  });

  it("bloqueia o 4º relatório no free e libera no pro", async () => {
    const id = await garantirUsuario();
    for (let i = 0; i < 3; i++) incrementarUso(id, "relatorios_criados");
    const uso = obterUso(id);
    expect(uso.relatorios_criados).toBe(3);
    const free = verificarLimite("free", uso, "relatorios");
    expect(free.permitido).toBe(false);
    expect(free.usados).toBe(3);
    expect(free.limite).toBe(3);
    expect(verificarLimite("pro", uso, "relatorios").permitido).toBe(true);
  });

  it("bloqueia o 11º reteste no free", async () => {
    const id = await garantirUsuario();
    for (let i = 0; i < 10; i++) incrementarUso(id, "retestes_registrados");
    const v = verificarLimite("free", obterUso(id), "retestes");
    expect(v.permitido).toBe(false);
    expect(v.limite).toBe(10);
  });

  it("mês novo começa zerado (reset automático)", async () => {
    const id = await garantirUsuario();
    incrementarUso(id, "relatorios_criados", "2026-01");
    expect(obterUso(id, "2026-01").relatorios_criados).toBe(1);
    expect(obterUso(id, mesAtual()).relatorios_criados).toBe(0);
    expect(resetarUsoMensal()).toBeGreaterThanOrEqual(1);
    expect(obterUso(id, "2026-01").relatorios_criados).toBe(0);
  });

  it("lerUso lê sem criar linha (checagem que não consome)", async () => {
    const id = await garantirUsuario();
    // Sem nenhum uso: zeros e nenhuma linha criada.
    expect(lerUso(id)).toEqual({ relatorios_criados: 0, retestes_registrados: 0 });
    const linhas = db
      .prepare("SELECT COUNT(*) AS n FROM uso_mensal WHERE usuario_id = ?")
      .get(id) as { n: number };
    expect(linhas.n).toBe(0);
    // Com uso existente: reflete sem duplicar.
    incrementarUso(id, "relatorios_criados");
    expect(lerUso(id).relatorios_criados).toBe(1);
  });
});

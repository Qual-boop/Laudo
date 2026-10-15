import { describe, expect, it, vi } from "vitest";

const USUARIO = { id: 0, nome: "QA Trial", email: "qa.trial@laudo-teste.com" };

vi.mock("@/lib/api-auth", () => ({
  exigirUsuario: vi.fn(async () => ({ ok: true, usuario: USUARIO })),
  erroApi: (error: string, code: string, status: number) =>
    Response.json({ error, code }, { status }),
}));

import db from "@/lib/db";
import { POST } from "@/app/api/v1/assinatura/testar-pro/route";
import { criarUsuario } from "@/lib/usuarios";

function requisicao(): Request {
  return new Request("http://localhost/api/v1/assinatura/testar-pro", {
    method: "POST",
  });
}

async function garantirUsuarioLimpo(): Promise<number> {
  db.prepare("DELETE FROM usuarios WHERE email = ?").run(USUARIO.email);
  const u = (await criarUsuario(USUARIO.nome, USUARIO.email, "senha-123456"))!;
  USUARIO.id = u.id;
  return u.id;
}

function limpar() {
  db.prepare("DELETE FROM usuarios WHERE email = ?").run(USUARIO.email);
  USUARIO.id = 0;
}

describe("testar-pro (trial uma vez por conta)", () => {
  it("primeiro trial ativa pro por 30 dias", async () => {
    await garantirUsuarioLimpo();
    try {
      const res = await POST(requisicao());
      expect(res.status).toBe(201);
      const corpo = (await res.json()) as { plano: string; trial: boolean };
      expect(corpo.plano).toBe("pro");
      expect(corpo.trial).toBe(true);
      const linha = db
        .prepare("SELECT trial_usado_em FROM usuarios WHERE id = ?")
        .get(USUARIO.id) as { trial_usado_em: string | null };
      expect(linha.trial_usado_em).not.toBeNull();
    } finally {
      limpar();
    }
  });

  it("segundo trial direto é bloqueado", async () => {
    await garantirUsuarioLimpo();
    try {
      expect((await POST(requisicao())).status).toBe(201);
      const segunda = await POST(requisicao());
      expect(segunda.status).toBe(409);
      const corpo = (await segunda.json()) as { code: string };
      expect(corpo.code).toBe("TRIAL_INDISPONIVEL");
    } finally {
      limpar();
    }
  });

  it("pagar→cancelar não libera novo trial", async () => {
    await garantirUsuarioLimpo();
    try {
      expect((await POST(requisicao())).status).toBe(201);
      // Simula ciclo pago + cancelamento (zera expira/subscription, como
      // fazem cancelar/route.ts e SUBSCRIPTION_DELETED — o carimbo fica).
      db.prepare(
        `UPDATE usuarios SET plano = 'free', asaas_subscription_id = NULL,
          plano_expira_em = NULL, assinatura_status = 'cancelada' WHERE id = ?`,
      ).run(USUARIO.id);
      const deNovo = await POST(requisicao());
      expect(deNovo.status).toBe(409);
      const corpo = (await deNovo.json()) as { code: string };
      expect(corpo.code).toBe("TRIAL_USADO");
    } finally {
      limpar();
    }
  });
});

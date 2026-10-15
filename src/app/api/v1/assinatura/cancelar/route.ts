import db from "@/lib/db";
import { exigirUsuario, erroApi } from "@/lib/api-auth";
import { cancelarAssinatura } from "@/lib/asaas";

/**
 * POST /api/v1/assinatura/cancelar — cancela a assinatura no Asaas e
 * volta a conta para free. (O Asaas não tem Customer Portal; o
 * cancelamento é via API.)
 */
export async function POST(request: Request) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  const u = db
    .prepare("SELECT asaas_subscription_id FROM usuarios WHERE id = ?")
    .get(auth.usuario.id) as { asaas_subscription_id: string | null };

  if (!u?.asaas_subscription_id) {
    return erroApi("Sem assinatura para cancelar.", "SEM_ASSINATURA", 409);
  }

  try {
    await cancelarAssinatura(u.asaas_subscription_id);
  } catch (e) {
    // 404 no Asaas = já cancelada/removida por lá: só limpa local.
    if ((e as { status?: number }).status !== 404) {
      const msg = e instanceof Error ? e.message : String(e);
      return erroApi(msg || "Falha ao cancelar.", "CANCELAMENTO_FALHOU", 502);
    }
  }

  db.prepare(
    `UPDATE usuarios SET plano = 'free', asaas_subscription_id = NULL,
      plano_expira_em = NULL, assinatura_status = 'cancelada',
      atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`,
  ).run(auth.usuario.id);

  return Response.json({ ok: true, plano: "free" });
}

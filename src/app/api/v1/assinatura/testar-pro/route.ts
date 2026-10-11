import db from "@/lib/db";
import { exigirUsuario, erroApi } from "@/lib/api-auth";

/**
 * POST /api/v1/assinatura/testar-pro — trial Pro de 30 dias, sem cartão.
 * Uma vez por conta: só parte do free e nunca sobrescreve assinatura paga.
 */
export async function POST(request: Request) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  const u = db
    .prepare(
      "SELECT plano, plano_expira_em, stripe_subscription_id FROM usuarios WHERE id = ?",
    )
    .get(auth.usuario.id) as {
    plano: string;
    plano_expira_em: string | null;
    stripe_subscription_id: string | null;
  };

  if (u.plano !== "free" || u.stripe_subscription_id) {
    return erroApi("Trial disponível só para contas free sem assinatura.", "TRIAL_INDISPONIVEL", 409);
  }
  // Trial já usado e expirado não renova: expira_em passado com plano free
  // indica trial anterior (assinatura nova sempre vem com subscription).
  if (u.plano_expira_em) {
    return erroApi("Você já usou o trial gratuito.", "TRIAL_USADO", 409);
  }

  const expira = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    "UPDATE usuarios SET plano = 'pro', plano_expira_em = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?",
  ).run(expira, auth.usuario.id);

  return Response.json({ plano: "pro", expiraEm: expira, trial: true }, { status: 201 });
}

import { buscarUm, executar } from "@/lib/banco";
import { exigirUsuario, erroApi } from "@/lib/api-auth";

/**
 * POST /api/v1/assinatura/testar-pro — trial Pro de 30 dias, sem cartão.
 * Uma vez por conta: só parte do free e nunca sobrescreve assinatura paga.
 */
export async function POST(request: Request) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  const u = await buscarUm<{
    plano: string;
    plano_expira_em: string | null;
    trial_usado_em: string | null;
    asaas_subscription_id: string | null;
  }>(
    "SELECT plano, plano_expira_em, trial_usado_em, asaas_subscription_id FROM usuarios WHERE id = ?",
    auth.usuario.id,
  );

  if (!u) {
    return erroApi("Usuário não existe mais.", "USUARIO_REMOVIDO", 401);
  }

  if (u.plano !== "free" || u.asaas_subscription_id) {
    return erroApi("Trial disponível só para contas free sem assinatura.", "TRIAL_INDISPONIVEL", 409);
  }
  // Uma vez por conta: o carimbo sobrevive a pagar→cancelar (plano_expira_em
  // é zerado no cancelamento). Legado: expira passado com plano free também
  // indica trial anterior.
  if (u.trial_usado_em || u.plano_expira_em) {
    return erroApi("Você já usou o trial gratuito.", "TRIAL_USADO", 409);
  }

  const expira = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await executar(
    "UPDATE usuarios SET plano = 'pro', plano_expira_em = ?, trial_usado_em = CURRENT_TIMESTAMP, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?",
    expira,
    auth.usuario.id,
  );

  return Response.json({ plano: "pro", expiraEm: expira, trial: true }, { status: 201 });
}

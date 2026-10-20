import { buscarUm } from "@/lib/banco";
import { exigirUsuario, erroApi } from "@/lib/api-auth";
import { assinaturaDe } from "@/lib/assinatura";

/**
 * GET /api/v1/assinatura — plano efetivo do usuário
 * ({ plano, expiraEm, subscriptionId, trial }).
 */
export async function GET(request: Request) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  const u = await buscarUm<{
    id: number;
    plano: string;
    plano_expira_em: string | null;
    stripe_subscription_id: string | null;
    stripe_customer_id: string | null;
    assinatura_status: string | null;
  }>(
    "SELECT id, plano, plano_expira_em, stripe_subscription_id, stripe_customer_id, assinatura_status FROM usuarios WHERE id = ?",
    auth.usuario.id,
  );

  if (!u) {
    return erroApi("Usuário não existe mais.", "USUARIO_REMOVIDO", 401);
  }

  return Response.json(await assinaturaDe(u));
}

export async function POST() {
  return erroApi("Use POST /api/v1/assinatura/testar-pro para o trial.", "METODO_INVALIDO", 405);
}

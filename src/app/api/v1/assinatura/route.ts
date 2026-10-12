import db from "@/lib/db";
import { exigirUsuario, erroApi } from "@/lib/api-auth";
import { assinaturaDe } from "@/lib/assinatura";

/**
 * GET /api/v1/assinatura — plano efetivo do usuário
 * ({ plano, expiraEm, subscriptionId, trial }).
 */
export async function GET(request: Request) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  const u = db
    .prepare(
      "SELECT id, plano, plano_expira_em, asaas_subscription_id FROM usuarios WHERE id = ?",
    )
    .get(auth.usuario.id) as {
    id: number;
    plano: string;
    plano_expira_em: string | null;
    asaas_subscription_id: string | null;
  };

  return Response.json(assinaturaDe(u));
}

export async function POST() {
  return erroApi("Use POST /api/v1/assinatura/testar-pro para o trial.", "METODO_INVALIDO", 405);
}

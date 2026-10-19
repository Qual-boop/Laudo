import { buscarTodos, buscarUm } from "@/lib/banco";
import { exigirUsuario } from "@/lib/api-auth";
import { emailAtivo } from "@/lib/email";

/**
 * GET /api/v1/auth/seguranca — estado de segurança da conta para o perfil:
 * verificação em duas etapas, e-mail comprovado e sessões abertas.
 */
export async function GET(request: Request) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  const u = await buscarUm<{ email_verificado_em: string | null }>(
    "SELECT email_verificado_em FROM usuarios WHERE id = ?",
    auth.usuario.id,
  );
  const sessoes = await buscarTodos<{ id: number }>(
    "SELECT id FROM sessoes WHERE usuario_id = ? AND expira_em > ?",
    auth.usuario.id,
    new Date().toISOString(),
  );

  return Response.json({
    duasEtapas: emailAtivo(),
    emailVerificado: Boolean(u?.email_verificado_em),
    sessoesAbertas: sessoes.length,
  });
}

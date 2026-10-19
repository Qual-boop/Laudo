import { erroApi } from "@/lib/api-auth";
import { conferirCodigo, emitirCodigo, mensagemConferencia } from "@/lib/codigos";
import { ipDoCliente, resposta429, verificarLogin } from "@/lib/limite-taxa";
import { buscarUsuarioPorEmail, compararSenha } from "@/lib/usuarios";
import { esquemaConfirmarLogin, validar } from "@/lib/validacao";

/**
 * POST /api/v1/auth/login/confirmar — 2ª etapa (pública).
 *
 * Senha + código certos → devolve um `ticket` de uso único (2 min) que o
 * navegador entrega ao NextAuth (`signIn("credentials", { email, ticket })`)
 * para criar a sessão. A senha volta a ser conferida aqui: o código sozinho
 * (ex.: e-mail invadido) não abre a conta.
 */
export async function POST(request: Request) {
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return erroApi("Corpo da requisição inválido.", "JSON_INVALIDO", 400);
  }

  const bloqueio = verificarLogin(
    ipDoCliente(request.headers),
    (corpo as { email?: unknown } | null)?.email,
  );
  if (bloqueio) return resposta429(bloqueio);

  const v = validar(esquemaConfirmarLogin, corpo);
  if (!v.ok) return v.resposta;

  const usuario = await buscarUsuarioPorEmail(v.dados.email);
  if (!usuario?.senha_hash || !(await compararSenha(v.dados.senha, usuario.senha_hash))) {
    return erroApi("E-mail ou senha inválidos.", "CREDENCIAIS_INVALIDAS", 401);
  }

  const r = await conferirCodigo(usuario.id, "login", v.dados.codigo);
  if (!r.ok) {
    return Response.json(
      { error: mensagemConferencia(r), code: "CODIGO_INVALIDO", motivo: r.motivo },
      { status: 401 },
    );
  }

  const ticket = await emitirCodigo(usuario.id, "ticket");
  if (!("codigo" in ticket)) {
    return erroApi("Tente de novo.", "TICKET_INDISPONIVEL", 500);
  }
  return Response.json({ ticket: ticket.codigo });
}

import { encode } from "next-auth/jwt";
import { executar } from "@/lib/banco";
import { criarSessao } from "@/lib/sessoes";
import {
  TOKEN_MAX_AGE_SEG,
  erroApi,
  exigirUsuario,
  hashToken,
  nomeCookieSessao,
} from "@/lib/api-auth";
import {
  ipDoCliente,
  liberarEmailLogin,
  resposta429,
  verificarLogin,
} from "@/lib/limite-taxa";
import { conferirCodigo } from "@/lib/codigos";
import { emailAtivo } from "@/lib/email";
import { buscarUsuarioPorEmail, compararSenha } from "@/lib/usuarios";
import { esquemaLogin, esquemaTicket, validar } from "@/lib/validacao";

/**
 * POST /api/v1/auth/token — login para clientes não-web (mobile/desktop).
 * Pública. Verifica e-mail + senha e devolve o MESMO JWT da sessão web:
 * use em `Authorization: Bearer <token>` em todas as rotas /api/v1/*.
 */
export async function POST(request: Request) {
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return erroApi("Corpo da requisição inválido.", "JSON_INVALIDO", 400);
  }

  // Antes de validar: tentativa malformada também conta.
  const bloqueio = verificarLogin(
    ipDoCliente(request.headers),
    (corpo as { email?: unknown } | null)?.email,
  );
  if (bloqueio) return resposta429(bloqueio);

  let usuario: Awaited<ReturnType<typeof buscarUsuarioPorEmail>>;
  if (emailAtivo()) {
    // Login em 2 etapas também para apps: /login/iniciar (senha → código
    // por e-mail) e /login/confirmar (código → ticket); aqui o ticket.
    const t = esquemaTicket.safeParse(corpo);
    if (!t.success) {
      return erroApi(
        "Login em duas etapas: chame /api/v1/auth/login/iniciar e /login/confirmar e envie { email, ticket }.",
        "CODIGO_NECESSARIO",
        401,
      );
    }
    usuario = await buscarUsuarioPorEmail(t.data.email);
    if (!usuario || !(await conferirCodigo(usuario.id, "ticket", t.data.ticket)).ok) {
      return erroApi("Ticket inválido ou expirado.", "TICKET_INVALIDO", 401);
    }
  } else {
    const v = validar(esquemaLogin, corpo);
    if (!v.ok) return v.resposta;
    usuario = await buscarUsuarioPorEmail(v.dados.email);
    // Mensagem genérica de propósito: não revela se o e-mail existe.
    if (!usuario?.senha_hash || !(await compararSenha(v.dados.senha, usuario.senha_hash))) {
      return erroApi("E-mail ou senha inválidos.", "CREDENCIAIS_INVALIDAS", 401);
    }
  }
  liberarEmailLogin(usuario.email);

  const segredo = process.env.AUTH_SECRET ?? "";
  if (!segredo) {
    return erroApi("Autenticação indisponível no servidor.", "AUTH_INDISPONIVEL", 500);
  }

  const expiraEm = new Date(Date.now() + TOKEN_MAX_AGE_SEG * 1000);
  // Placeholder único (o antigo "pendente" fixo batia no UNIQUE de
  // token_hash quando dois logins chegavam juntos); o hash real vem abaixo.
  const jti = await criarSessao(usuario.id);

  const token = await encode({
    token: {
      sub: String(usuario.id),
      usuarioId: usuario.id,
      name: usuario.nome,
      email: usuario.email,
      // `sid` (não `jti`): o encode sobrescreve `jti` com UUID aleatório.
      sid: jti,
    },
    secret: segredo,
    salt: nomeCookieSessao(),
    maxAge: TOKEN_MAX_AGE_SEG,
  });

  await executar(
    "UPDATE sessoes SET token_hash = ? WHERE id = ?",
    hashToken(token),
    jti,
  );

  return Response.json({ token, expiraEm: expiraEm.toISOString() });
}

/** DELETE /api/v1/auth/token — revoga a sessão Bearer atual (logout mobile). */
export async function DELETE(request: Request) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return erroApi("Envie o token em Authorization: Bearer.", "TOKEN_AUSENTE", 400);
  }

  await executar(
    "DELETE FROM sessoes WHERE token_hash = ?",
    hashToken(authHeader.slice("Bearer ".length)),
  );

  return Response.json({ ok: true });
}

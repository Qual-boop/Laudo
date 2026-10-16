import { encode } from "next-auth/jwt";
import { executar, inserir } from "@/lib/banco";
import {
  TOKEN_MAX_AGE_SEG,
  erroApi,
  exigirUsuario,
  hashToken,
  nomeCookieSessao,
} from "@/lib/api-auth";
import { buscarUsuarioPorEmail, compararSenha } from "@/lib/usuarios";
import { esquemaLogin, validar } from "@/lib/validacao";

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

  const v = validar(esquemaLogin, corpo);
  if (!v.ok) return v.resposta;

  const usuario = await buscarUsuarioPorEmail(v.dados.email);
  // Mensagem genérica de propósito: não revela se o e-mail existe.
  if (!usuario?.senha_hash) {
    return erroApi("E-mail ou senha inválidos.", "CREDENCIAIS_INVALIDAS", 401);
  }
  if (!(await compararSenha(v.dados.senha, usuario.senha_hash))) {
    return erroApi("E-mail ou senha inválidos.", "CREDENCIAIS_INVALIDAS", 401);
  }

  const segredo = process.env.AUTH_SECRET ?? "";
  if (!segredo) {
    return erroApi("Autenticação indisponível no servidor.", "AUTH_INDISPONIVEL", 500);
  }

  const expiraEm = new Date(Date.now() + TOKEN_MAX_AGE_SEG * 1000);
  const jti = await inserir(
    "INSERT INTO sessoes (usuario_id, token_hash, expira_em) VALUES (?, ?, ?)",
    usuario.id,
    "pendente",
    expiraEm.toISOString(),
  );

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

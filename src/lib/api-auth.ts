import { createHash } from "node:crypto";
import { getToken } from "next-auth/jwt";
import db from "@/lib/db";
import { buscarUsuarioPorId, type Usuario } from "@/lib/usuarios";

/**
 * Guarda das rotas /api/v1/* (exceto auth).
 *
 * Aceita o mesmo JWT de dois jeitos — é isso que permite web, mobile e
 * desktop usarem o mesmo token:
 *   1. cookie de sessão do NextAuth (web — o fetch same-origin envia sozinho)
 *   2. header `Authorization: Bearer <jwt>` (mobile/desktop — via /api/v1/auth/token)
 *
 * Tokens Bearer carregam `jti` (= id da linha em `sessoes`); nesse caso a
 * sessão precisa existir e estar válida (permite revogar no logout).
 * Sessões cookie do NextAuth são gerenciadas pelo próprio NextAuth.
 */

export type ErroApi = { error: string; code: string };

export function erroApi(error: string, code: string, status: number): Response {
  return Response.json({ error, code } satisfies ErroApi, { status });
}

function segredo(): string {
  return process.env.AUTH_SECRET ?? "";
}

function cookieSeguro(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Nome do cookie de sessão do NextAuth — também é o `salt` do JWT. */
export function nomeCookieSessao(): string {
  return cookieSeguro()
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
}

/** Validade padrão dos tokens mobile (30 dias, igual à sessão web). */
export const TOKEN_MAX_AGE_SEG = 30 * 24 * 60 * 60;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type UsuarioAutenticado = Pick<Usuario, "id" | "nome" | "email">;

export async function exigirUsuario(
  req: Request,
): Promise<
  | { ok: true; usuario: UsuarioAutenticado }
  | { ok: false; resposta: Response }
> {
  if (!segredo()) {
    return {
      ok: false,
      resposta: erroApi("Autenticação indisponível no servidor.", "AUTH_INDISPONIVEL", 500),
    };
  }

  const token = await getToken({
    req: req as unknown as Parameters<typeof getToken>[0]["req"],
    secret: segredo(),
    secureCookie: cookieSeguro(),
  }).catch(() => null);

  if (!token) {
    return {
      ok: false,
      resposta: erroApi("Não autenticado. Faça login.", "NAO_AUTENTICADO", 401),
    };
  }

  const usuarioId = Number(
    (token as Record<string, unknown>).usuarioId ?? token.sub,
  );
  if (!Number.isInteger(usuarioId)) {
    return {
      ok: false,
      resposta: erroApi("Token inválido.", "TOKEN_INVALIDO", 401),
    };
  }

  // Bearer de mobile/desktop: confere revogação e expiração em `sessoes`.
  // (Claim próprio `sid`: o `jti` é sobrescrito pelo encode com UUID.)
  const sid = (token as Record<string, unknown>).sid;
  if (typeof sid === "number" || (typeof sid === "string" && sid)) {
    const sessao = db
      .prepare("SELECT usuario_id, expira_em FROM sessoes WHERE id = ?")
      .get(Number(sid)) as { usuario_id: number; expira_em: string } | undefined;
    if (
      !sessao ||
      sessao.usuario_id !== usuarioId ||
      new Date(sessao.expira_em).getTime() < Date.now()
    ) {
      return {
        ok: false,
        resposta: erroApi("Sessão expirada ou revogada. Faça login de novo.", "SESSAO_INVALIDA", 401),
      };
    }
  }

  const usuario = buscarUsuarioPorId(usuarioId);
  if (!usuario) {
    return {
      ok: false,
      resposta: erroApi("Usuário não existe mais.", "USUARIO_REMOVIDO", 401),
    };
  }

  return { ok: true, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } };
}

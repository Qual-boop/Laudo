import { createHash } from "node:crypto";
import { getToken } from "next-auth/jwt";
import { buscarUm } from "@/lib/banco";
import { buscarUsuarioPorId, type Usuario } from "@/lib/usuarios";
import { assinaturaDe } from "@/lib/assinatura";
import type { Plano } from "@/lib/planos";

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

/**
 * Os dois nomes possíveis, principal primeiro. O Auth.js escolhe o prefixo
 * `__Secure-` pelo protocolo efetivo do request (http direto → sem prefixo,
 * mesmo com NODE_ENV=production), então tentamos os dois para nunca perder
 * uma sessão válida por divergência de nome.
 */
export function nomesCookieSessao(): [string, string] {
  const principal = nomeCookieSessao();
  const alternativo = principal.startsWith("__Secure-")
    ? "authjs.session-token"
    : "__Secure-authjs.session-token";
  return [principal, alternativo];
}

/** Lê o JWT do cookie ou do Bearer, testando os dois nomes de cookie. */
export async function lerToken(req: Request): Promise<Record<string, unknown> | null> {
  for (const cookieName of nomesCookieSessao()) {
    const token = await getToken({
      req: req as unknown as Parameters<typeof getToken>[0]["req"],
      secret: segredo(),
      cookieName,
    }).catch(() => null);
    if (token) return token as unknown as Record<string, unknown>;
  }
  return null;
}

/** Validade padrão dos tokens mobile (30 dias, igual à sessão web). */
export const TOKEN_MAX_AGE_SEG = 30 * 24 * 60 * 60;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type UsuarioAutenticado = Pick<Usuario, "id" | "nome" | "email"> & {
  plano: Plano;
};

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

  const token = await lerToken(req);

  if (!token) {
    return {
      ok: false,
      resposta: erroApi("Não autenticado. Faça login.", "NAO_AUTENTICADO", 401),
    };
  }

  const usuarioId = Number(token.usuarioId ?? token.sub);
  if (!Number.isInteger(usuarioId)) {
    return {
      ok: false,
      resposta: erroApi("Token inválido.", "TOKEN_INVALIDO", 401),
    };
  }

  // Bearer de mobile/desktop: confere revogação e expiração em `sessoes`.
  // (Claim próprio `sid`: o `jti` é sobrescrito pelo encode com UUID.)
  const sid = token.sid;
  if (typeof sid === "number" || (typeof sid === "string" && sid)) {
    const sessao = await buscarUm<{ usuario_id: number; expira_em: string }>(
      "SELECT usuario_id, expira_em FROM sessoes WHERE id = ?",
      Number(sid),
    );
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

  const usuario = await buscarUsuarioPorId(usuarioId);
  if (!usuario) {
    return {
      ok: false,
      resposta: erroApi("Usuário não existe mais.", "USUARIO_REMOVIDO", 401),
    };
  }

  return {
    ok: true,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      plano: (await assinaturaDe(usuario)).plano,
    },
  };
}

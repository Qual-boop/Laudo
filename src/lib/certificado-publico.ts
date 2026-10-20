import { randomBytes } from "node:crypto";
import { buscarUm, executar } from "@/lib/banco";
import { assinaturaDe } from "@/lib/assinatura";
import { LIMITES, type Plano } from "@/lib/planos";
import {
  carregarDadosCertificado,
  type Certificado,
} from "@/lib/certificado-dados";

/**
 * Link público do certificado: `/c/<token>`, sem login, para o cliente final
 * do pentester conferir o certificado.
 *
 * O token é a única credencial do link: 256 bits aleatórios (CSPRNG), sem
 * relação com o id do relatório. Revogar zera a coluna — o endereço antigo
 * morre para sempre e um novo link gera outro token.
 *
 * O link só abre certificado emitido (100% verificado) de dono Pro/Team,
 * conferidos a cada acesso: se um achado volta a falhar ou o plano cai para
 * free, o link para de abrir sem precisar ser revogado.
 */

/** 32 bytes em base64url: 43 caracteres, sem padding. */
export function gerarTokenCertificado(): string {
  return randomBytes(32).toString("base64url");
}

const FORMATO_TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** Barra lixo antes de ir ao banco (e mantém a consulta sempre indexada). */
export function tokenCertificadoValido(token: unknown): token is string {
  return typeof token === "string" && FORMATO_TOKEN.test(token);
}

/** Token atual do relatório, ou null se não há link ativo. */
export async function tokenPublicoDe(relatorioId: number): Promise<string | null> {
  const linha = await buscarUm<{ certificado_token: string | null }>(
    "SELECT certificado_token FROM relatorios WHERE id = ?",
    relatorioId,
  );
  return linha?.certificado_token ?? null;
}

export type ResultadoLink =
  | { ok: true; token: string }
  | { ok: false; motivo: "nao-encontrado" | "acesso-negado" | "plano" | "pendente" };

/**
 * Cria o link (ou devolve o já ativo — idempotente). Só para o dono, em plano
 * pago e com o certificado já emitido.
 */
export async function ativarLinkPublico(
  relatorioId: number,
  usuario: { id: number; plano: Plano },
): Promise<ResultadoLink> {
  const linha = await buscarUm<{
    usuario_id: number | null;
    certificado_token: string | null;
  }>(
    "SELECT usuario_id, certificado_token FROM relatorios WHERE id = ?",
    relatorioId,
  );
  if (!linha) return { ok: false, motivo: "nao-encontrado" };
  if (linha.usuario_id !== usuario.id) return { ok: false, motivo: "acesso-negado" };
  if (!LIMITES[usuario.plano].certificado) return { ok: false, motivo: "plano" };

  const certificado = await carregarDadosCertificado(relatorioId);
  if (!certificado?.progresso.completo) return { ok: false, motivo: "pendente" };

  if (linha.certificado_token) return { ok: true, token: linha.certificado_token };

  // `IS NULL` no WHERE: dois cliques simultâneos não sobrescrevem o token um
  // do outro — quem perde a corrida relê o que ficou gravado.
  const novo = gerarTokenCertificado();
  await executar(
    "UPDATE relatorios SET certificado_token = ? WHERE id = ? AND certificado_token IS NULL",
    novo,
    relatorioId,
  );
  const gravado = await tokenPublicoDe(relatorioId);
  return gravado
    ? { ok: true, token: gravado }
    : { ok: false, motivo: "nao-encontrado" };
}

/** Desliga o link. Vale em qualquer plano: revogar nunca é bloqueado. */
export async function revogarLinkPublico(
  relatorioId: number,
  usuarioId: number,
): Promise<{ ok: true } | { ok: false; motivo: "nao-encontrado" | "acesso-negado" }> {
  const linha = await buscarUm<{ usuario_id: number | null }>(
    "SELECT usuario_id FROM relatorios WHERE id = ?",
    relatorioId,
  );
  if (!linha) return { ok: false, motivo: "nao-encontrado" };
  if (linha.usuario_id !== usuarioId) return { ok: false, motivo: "acesso-negado" };

  await executar(
    "UPDATE relatorios SET certificado_token = NULL WHERE id = ?",
    relatorioId,
  );
  return { ok: true };
}

/**
 * Certificado aberto pelo link público, ou null (token inválido, revogado,
 * dono sem plano pago ou certificado não mais 100% verificado). A página
 * responde 404 em todos os casos, sem dizer qual.
 */
export async function certificadoPorToken(token: unknown): Promise<Certificado | null> {
  if (!tokenCertificadoValido(token)) return null;

  const linha = await buscarUm<{
    relatorio_id: number;
    usuario_id: number;
    plano: string;
    plano_expira_em: string | null;
    stripe_subscription_id: string | null;
  }>(
    `SELECT r.id AS relatorio_id, u.id AS usuario_id, u.plano,
            u.plano_expira_em, u.stripe_subscription_id
       FROM relatorios r
       JOIN usuarios u ON u.id = r.usuario_id
      WHERE r.certificado_token = ?`,
    token,
  );
  if (!linha) return null;

  const { plano } = await assinaturaDe({
    id: Number(linha.usuario_id),
    plano: linha.plano,
    plano_expira_em: linha.plano_expira_em,
    stripe_subscription_id: linha.stripe_subscription_id,
  });
  if (!LIMITES[plano].certificado) return null;

  const certificado = await carregarDadosCertificado(Number(linha.relatorio_id));
  if (!certificado?.progresso.completo) return null;

  return certificado;
}

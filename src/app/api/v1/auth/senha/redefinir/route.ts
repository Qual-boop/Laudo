import { executar } from "@/lib/banco";
import { erroApi } from "@/lib/api-auth";
import { conferirCodigo, mensagemConferencia } from "@/lib/codigos";
import { ipDoCliente, resposta429, verificarLogin } from "@/lib/limite-taxa";
import { revogarTodas } from "@/lib/sessoes";
import { buscarUsuarioPorEmail, hashSenha } from "@/lib/usuarios";
import { esquemaRedefinirSenha, validar } from "@/lib/validacao";

/**
 * POST /api/v1/auth/senha/redefinir — código do e-mail + senha nova
 * (pública). Troca a senha e derruba TODAS as sessões abertas: se alguém
 * entrou com a senha antiga, perde o acesso na hora.
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

  const v = validar(esquemaRedefinirSenha, corpo);
  if (!v.ok) return v.resposta;

  const usuario = await buscarUsuarioPorEmail(v.dados.email);
  if (!usuario) {
    // Mesmo texto de código expirado: não confirma se a conta existe.
    return Response.json(
      { error: "Código expirado. Peça um novo.", code: "CODIGO_INVALIDO", motivo: "expirado" },
      { status: 401 },
    );
  }

  const r = await conferirCodigo(usuario.id, "senha", v.dados.codigo);
  if (!r.ok) {
    return Response.json(
      { error: mensagemConferencia(r), code: "CODIGO_INVALIDO", motivo: r.motivo },
      { status: 401 },
    );
  }

  await executar(
    "UPDATE usuarios SET senha_hash = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?",
    await hashSenha(v.dados.senha),
    usuario.id,
  );
  const encerradas = await revogarTodas(usuario.id);

  return Response.json({ ok: true, sessoesEncerradas: encerradas });
}

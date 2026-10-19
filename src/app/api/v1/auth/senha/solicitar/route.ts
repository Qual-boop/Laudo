import { erroApi } from "@/lib/api-auth";
import { VALIDADE_MIN, emitirCodigo } from "@/lib/codigos";
import { emailAtivo, enviarEmail, mensagemCodigo } from "@/lib/email";
import { ipDoCliente, resposta429, verificarEnvioCodigo } from "@/lib/limite-taxa";
import { buscarUsuarioPorEmail } from "@/lib/usuarios";
import { esquemaSolicitarSenha, validar } from "@/lib/validacao";
import { EMAIL_CONTATO } from "@/lib/site";

/**
 * POST /api/v1/auth/senha/solicitar — "esqueci minha senha" (pública).
 *
 * Resposta sempre igual, exista ou não a conta: a tela não pode virar
 * oráculo de "este e-mail tem cadastro". O código só sai se existir.
 */
export async function POST(request: Request) {
  if (!emailAtivo()) {
    return erroApi(
      `Recuperação por e-mail ainda não está disponível. Escreva para ${EMAIL_CONTATO}.`,
      "EMAIL_INDISPONIVEL",
      503,
    );
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return erroApi("Corpo da requisição inválido.", "JSON_INVALIDO", 400);
  }

  const bloqueio = verificarEnvioCodigo(
    ipDoCliente(request.headers),
    (corpo as { email?: unknown } | null)?.email,
  );
  if (bloqueio) return resposta429(bloqueio);

  const v = validar(esquemaSolicitarSenha, corpo);
  if (!v.ok) return v.resposta;

  const generica = Response.json({
    ok: true,
    mensagem: "Se houver uma conta com este e-mail, o código chega em instantes.",
  });

  const usuario = await buscarUsuarioPorEmail(v.dados.email);
  if (!usuario) return generica;

  const emissao = await emitirCodigo(usuario.id, "senha");
  if ("codigo" in emissao) {
    // Falha de envio também responde igual (não vaza a existência da
    // conta); fica no log para diagnóstico.
    await enviarEmail(
      mensagemCodigo(usuario.email, usuario.nome, emissao.codigo, "senha", VALIDADE_MIN.senha),
    ).catch(() => {});
  }
  return generica;
}

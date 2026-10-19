import { erroApi } from "@/lib/api-auth";
import { VALIDADE_MIN, emitirCodigo } from "@/lib/codigos";
import { emailAtivo, enviarEmail, mascararEmail, mensagemCodigo } from "@/lib/email";
import {
  ipDoCliente,
  resposta429,
  verificarEnvioCodigo,
  verificarLogin,
} from "@/lib/limite-taxa";
import { buscarUsuarioPorEmail, compararSenha } from "@/lib/usuarios";
import { esquemaLogin, validar } from "@/lib/validacao";

/**
 * POST /api/v1/auth/login/iniciar — 1ª etapa do login (pública).
 *
 * Confere e-mail + senha. Com e-mail configurado no servidor, manda um
 * código de 6 dígitos e responde `{ etapa: "codigo" }`: a sessão só nasce
 * em /login/confirmar. Sem provedor de e-mail, responde `{ etapa: "senha" }`
 * e o navegador entra direto com a senha (comportamento antigo).
 */
export async function POST(request: Request) {
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return erroApi("Corpo da requisição inválido.", "JSON_INVALIDO", 400);
  }

  const ip = ipDoCliente(request.headers);
  // Mesmo contador do login: senha errada aqui conta como tentativa.
  const bloqueio = verificarLogin(ip, (corpo as { email?: unknown } | null)?.email);
  if (bloqueio) return resposta429(bloqueio);

  const v = validar(esquemaLogin, corpo);
  if (!v.ok) return v.resposta;

  const usuario = await buscarUsuarioPorEmail(v.dados.email);
  // Mensagem genérica de propósito: não revela se o e-mail existe.
  if (!usuario?.senha_hash || !(await compararSenha(v.dados.senha, usuario.senha_hash))) {
    return erroApi("E-mail ou senha inválidos.", "CREDENCIAIS_INVALIDAS", 401);
  }

  if (!emailAtivo()) return Response.json({ etapa: "senha" });

  const envio = verificarEnvioCodigo(ip, v.dados.email);
  if (envio) return resposta429(envio);

  const emissao = await emitirCodigo(usuario.id, "login");
  if ("aguardeSeg" in emissao) {
    // Código anterior ainda fresco: a tela segue pedindo o mesmo código.
    return Response.json({
      etapa: "codigo",
      email: mascararEmail(usuario.email),
      reenvioEmSeg: emissao.aguardeSeg,
    });
  }

  try {
    await enviarEmail(
      mensagemCodigo(usuario.email, usuario.nome, emissao.codigo, "login", VALIDADE_MIN.login),
    );
  } catch {
    return erroApi(
      "Não foi possível enviar o código agora. Tente de novo em instantes.",
      "EMAIL_FALHOU",
      502,
    );
  }

  return Response.json({
    etapa: "codigo",
    email: mascararEmail(usuario.email),
    validadeMin: VALIDADE_MIN.login,
  });
}

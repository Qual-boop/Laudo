import { criarUsuario } from "@/lib/usuarios";
import { erroApi } from "@/lib/api-auth";
import { esquemaCadastro, validar } from "@/lib/validacao";

/** POST /api/v1/auth/cadastro — cria conta com e-mail + senha. Pública. */
export async function POST(request: Request) {
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return erroApi("Corpo da requisição inválido.", "JSON_INVALIDO", 400);
  }

  const v = validar(esquemaCadastro, corpo);
  if (!v.ok) return v.resposta;

  const usuario = await criarUsuario(v.dados.nome, v.dados.email, v.dados.senha);
  if (!usuario) {
    return erroApi("Este e-mail já está em uso.", "EMAIL_EM_USO", 409);
  }

  return Response.json(
    { id: usuario.id, nome: usuario.nome, email: usuario.email },
    { status: 201 },
  );
}

/** GET não existe aqui — evita enumerar o endpoint no escuro. */
export async function GET() {
  return erroApi("Use POST com nome, email e senha.", "METODO_INVALIDO", 405);
}

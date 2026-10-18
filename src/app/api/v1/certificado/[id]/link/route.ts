import { exigirUsuario, erroApi } from "@/lib/api-auth";
import { esquemaId, validar } from "@/lib/validacao";
import {
  ativarLinkPublico,
  revogarLinkPublico,
} from "@/lib/certificado-publico";

/**
 * Link público do certificado (`/c/<token>`).
 *   POST   → cria o link ou devolve o já ativo (idempotente)
 *   DELETE → revoga (o endereço antigo deixa de abrir)
 * Só o dono do relatório.
 */

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  const { id: bruto } = await ctx.params;
  const v = validar(esquemaId, bruto);
  if (!v.ok) return v.resposta;

  const resultado = await ativarLinkPublico(v.dados, auth.usuario);
  if (resultado.ok) {
    return Response.json({
      token: resultado.token,
      caminho: `/c/${resultado.token}`,
    });
  }

  switch (resultado.motivo) {
    case "nao-encontrado":
      return erroApi("Relatório não encontrado.", "NAO_ENCONTRADO", 404);
    case "acesso-negado":
      return erroApi("Acesso negado a este relatório.", "ACESSO_NEGADO", 403);
    case "plano":
      return Response.json(
        {
          error: "Certificado disponível nos planos Pro e Team.",
          code: "LIMITE_PLANO",
          recurso: "certificado",
          plano: auth.usuario.plano,
        },
        { status: 402 },
      );
    case "pendente":
      return erroApi(
        "O link público só existe para certificado emitido (todos os achados verificados).",
        "CERTIFICADO_PENDENTE",
        409,
      );
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  const { id: bruto } = await ctx.params;
  const v = validar(esquemaId, bruto);
  if (!v.ok) return v.resposta;

  const resultado = await revogarLinkPublico(v.dados, auth.usuario.id);
  if (resultado.ok) return Response.json({ revogado: true });

  return resultado.motivo === "nao-encontrado"
    ? erroApi("Relatório não encontrado.", "NAO_ENCONTRADO", 404)
    : erroApi("Acesso negado a este relatório.", "ACESSO_NEGADO", 403);
}

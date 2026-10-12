import { exigirUsuario, erroApi } from "@/lib/api-auth";
import { LIMITES } from "@/lib/planos";
import { esquemaId, validar } from "@/lib/validacao";
import {
  carregarDadosCertificado,
  donoDoRelatorio,
} from "@/lib/certificado-dados";

/**
 * GET /api/v1/certificado/[id] — certificado em JSON (mobile/desktop).
 * Exige plano pago; 404 se inexistente ou ainda incompleto.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  const { id: bruto } = await ctx.params;
  const v = validar(esquemaId, bruto);
  if (!v.ok) return v.resposta;

  const dono = donoDoRelatorio(v.dados);
  if (dono === null) {
    return erroApi("Relatório não encontrado.", "NAO_ENCONTRADO", 404);
  }
  if (dono !== auth.usuario.id) {
    return erroApi("Acesso negado a este relatório.", "ACESSO_NEGADO", 403);
  }

  if (!LIMITES[auth.usuario.plano].certificado) {
    return Response.json(
      {
        error: "Certificado disponível nos planos Pro e Team.",
        code: "LIMITE_PLANO",
        recurso: "certificado",
        plano: auth.usuario.plano,
      },
      { status: 402 },
    );
  }

  const certificado = carregarDadosCertificado(v.dados);
  if (!certificado) {
    return erroApi("Relatório não encontrado.", "NAO_ENCONTRADO", 404);
  }
  if (!certificado.progresso.completo) {
    return erroApi(
      `Certificado pendente: ${certificado.progresso.verificados}/${certificado.progresso.total} verificados.`,
      "CERTIFICADO_PENDENTE",
      404,
    );
  }

  return Response.json(certificado);
}

import { exigirUsuario, erroApi } from "@/lib/api-auth";
import { EscudoPrivacidade } from "@/lib/anonimizacao";
import { gerarRelatorio } from "@/lib/ia";
import { lerUso, verificarLimite } from "@/lib/limites";
import { normalizarPlano } from "@/lib/planos";
import { esquemaGerar, validar } from "@/lib/validacao";

/** POST /api/v1/gerar — gera relatório via IA (ou fallback local). */
export async function POST(request: Request) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return erroApi("Corpo da requisição inválido.", "JSON_INVALIDO", 400);
  }

  const v = validar(esquemaGerar, corpo);
  if (!v.ok) return v.resposta;

  // Gerar consome IA paga: bloqueia quando a cota de relatórios acabou.
  // Leitura sem escrita (lerUso) — o consumo acontece no salvar.
  const veredito = verificarLimite(
    normalizarPlano(auth.usuario.plano),
    await lerUso(auth.usuario.id),
    "relatorios",
  );
  if (!veredito.permitido) {
    return Response.json(
      {
        error: `Você usou ${veredito.usados}/${veredito.limite} relatórios este mês. Faça upgrade para continuar gerando.`,
        code: "LIMITE_PLANO",
        recurso: "relatorios",
        usados: veredito.usados,
        limite: veredito.limite,
      },
      { status: 402 },
    );
  }

  // Escudo de privacidade: a IA só vê marcadores; os dados reais voltam
  // aqui, depois da resposta. A tabela de troca morre com a requisição.
  const escudo = new EscudoPrivacidade([v.dados.cliente]);
  const relatorio = escudo.restaurar(await gerarRelatorio(escudo.anonimizar(v.dados)));

  return Response.json(relatorio, {
    headers: { "X-Laudo-Protegidos": escudo.cabecalho() },
  });
}

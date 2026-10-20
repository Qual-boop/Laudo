import { buscarUm, executar } from "@/lib/banco";
import { exigirUsuario, erroApi } from "@/lib/api-auth";
import type { Periodo, PlanoPago } from "@/lib/planos";
import { URL_SITE } from "@/lib/site";
import { criarCheckout, criarCliente, stripeConfigurado } from "@/lib/stripe";

/**
 * POST /api/v1/checkout — cria a sessão de checkout recorrente no Stripe.
 * Body: { plano: "pro" | "team", periodo: "mensal" | "anual" (alias: ciclo) }.
 * Devolve { url } do checkout hospedado pelo Stripe.
 */
export async function POST(request: Request) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return erroApi("Corpo da requisição inválido.", "JSON_INVALIDO", 400);
  }

  const b = (corpo ?? {}) as Record<string, unknown>;
  const plano = b.plano as PlanoPago;
  const periodo = ((b.periodo ?? b.ciclo) ?? "mensal") as Periodo;

  if (plano !== "pro" && plano !== "team") {
    return erroApi("plano deve ser pro ou team.", "VALIDACAO", 400);
  }
  if (periodo !== "mensal" && periodo !== "anual") {
    return erroApi("periodo deve ser mensal ou anual.", "VALIDACAO", 400);
  }
  if (!stripeConfigurado()) {
    return erroApi(
      "Pagamentos ainda não estão disponíveis. Tente de novo em breve.",
      "PAGAMENTO_INDISPONIVEL",
      503,
    );
  }

  const usuario = await buscarUm<{
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
  }>(
    "SELECT stripe_customer_id, stripe_subscription_id FROM usuarios WHERE id = ?",
    auth.usuario.id,
  );

  // Uma assinatura por conta: trocar de plano, reativar ou cancelar é no
  // portal (sem isso daria para pagar duas vezes). O webhook de exclusão
  // limpa o id quando a assinatura acaba de vez.
  if (usuario?.stripe_subscription_id) {
    return erroApi(
      "Você já tem uma assinatura. Use \"gerenciar assinatura\" no perfil para trocar de plano, reativar ou cancelar.",
      "ASSINATURA_EXISTENTE",
      409,
    );
  }

  try {
    let customerId = usuario?.stripe_customer_id ?? null;
    if (!customerId) {
      customerId = (
        await criarCliente({
          nome: auth.usuario.nome,
          email: auth.usuario.email,
          usuarioId: auth.usuario.id,
        })
      ).id;
      await executar(
        "UPDATE usuarios SET stripe_customer_id = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?",
        customerId,
        auth.usuario.id,
      );
    }

    const sessao = await criarCheckout({
      customerId,
      usuarioId: auth.usuario.id,
      plano,
      periodo,
      // URL pública fixa: atrás do proxy do Railway, request.url chega
      // com o host interno.
      urlSucesso: `${URL_SITE}/perfil?assinatura=ok`,
      urlCancelado: `${URL_SITE}/precos?assinatura=cancelada`,
    });
    return Response.json({ url: sessao.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return erroApi(msg || "Falha ao criar checkout.", "CHECKOUT_FALHOU", 502);
  }
}

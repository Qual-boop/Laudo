import { buscarUm, executar } from "@/lib/banco";
import { exigirUsuario, erroApi } from "@/lib/api-auth";
import {
  criarCheckout,
  criarCliente,
  type Ciclo,
  type PlanoPago,
} from "@/lib/asaas";

/**
 * POST /api/v1/checkout — cria checkout recorrente no Asaas.
 * Body: { plano: "pro" | "team", periodo: "mensal" | "anual" (alias: ciclo) }.
 * Devolve { url } do checkout hospedado pelo Asaas.
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
  const periodo = ((b.periodo ?? b.ciclo) ?? "mensal") as Ciclo;

  if (plano !== "pro" && plano !== "team") {
    return erroApi("plano deve ser pro ou team.", "VALIDACAO", 400);
  }
  if (periodo !== "mensal" && periodo !== "anual") {
    return erroApi("periodo deve ser mensal ou anual.", "VALIDACAO", 400);
  }
  if (!process.env.ASAAS_API_KEY) {
    return erroApi(
      "Checkout indisponível: ASAAS_API_KEY não configurada.",
      "ASAAS_AUSENTE",
      500,
    );
  }

  const usuario = await buscarUm<{
    id: number;
    nome: string;
    email: string;
    asaas_customer_id: string | null;
    asaas_subscription_id: string | null;
    assinatura_status: string | null;
  }>(
    "SELECT id, nome, email, asaas_customer_id, asaas_subscription_id, assinatura_status FROM usuarios WHERE id = ?",
    auth.usuario.id,
  );

  // Sem trava, um assinante ativo pagaria dobrado abrindo outro checkout
  // (a UI desabilita, mas a API permitia). Trial (pro sem subscription)
  // e ex-assinante podem assinar normalmente.
  if (usuario?.asaas_subscription_id && usuario?.assinatura_status === "ativa") {
    return erroApi(
      "Você já tem uma assinatura ativa. Cancele a atual antes de assinar de novo.",
      "ASSINATURA_ATIVA",
      409,
    );
  }

  try {
    let customerId = usuario?.asaas_customer_id ?? null;
    if (!customerId) {
      // O Asaas pode exigir cpfCnpj conforme a conta; sem ele, o erro
      // volta transparente para o cliente decidir (ver ASAAS-SETUP.md).
      const cliente = await criarCliente({
        name: usuario?.nome ?? auth.usuario.nome,
        email: usuario?.email ?? auth.usuario.email,
      });
      customerId = cliente.id;
      await executar(
        "UPDATE usuarios SET asaas_customer_id = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?",
        customerId,
        auth.usuario.id,
      );
    }

    // Base pública para os redirects do Asaas: em produção usa
    // NEXT_PUBLIC_APP_URL (ex.: https://laudo.vercel.app); local cai
    // para a origem da requisição.
    const base =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ||
      new URL(request.url).origin;
    const checkout = await criarCheckout({
      customerId,
      planoCiclo: `${plano}_${periodo}`,
      referencia: `${auth.usuario.id}:${plano}:${periodo}`,
      preencheCliente: { name: auth.usuario.nome, email: auth.usuario.email },
      successUrl: `${base}/perfil?assinatura=ok`,
      cancelUrl: `${base}/precos?assinatura=cancelada`,
      expiredUrl: `${base}/precos?assinatura=expirada`,
    });

    // A API devolve `link`; fallback monta a URL canônica.
    const url =
      checkout.link ?? `https://asaas.com/checkoutSession/show?id=${checkout.id}`;
    return Response.json({ url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = (e as { status?: number }).status ?? 502;
    return erroApi(msg || "Falha ao criar checkout.", "CHECKOUT_FALHOU", status);
  }
}

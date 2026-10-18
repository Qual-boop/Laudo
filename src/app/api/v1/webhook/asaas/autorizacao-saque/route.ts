/**
 * POST /api/v1/webhook/asaas/autorizacao-saque — trava de saques.
 *
 * O Asaas chama esta URL antes de processar qualquer saque pedido pela
 * API (transferência, Pix, pagamento de conta, recarga…) e só executa se
 * a resposta for `{ "status": "APPROVED" }`. O Provafix só cobra
 * assinaturas: nunca pede saque. Então TODA operação é recusada — se a
 * ASAAS_API_KEY vazar, ninguém tira dinheiro da conta por ela.
 *
 * Recusar não depende do token: quem acerta ou erra o
 * `asaas-access-token` recebe o mesmo REFUSED (nunca há caminho que
 * aprove). O token (ASAAS_SAQUE_TOKEN) só separa, no log, a tentativa
 * real vinda do Asaas — que é alerta de chave vazada — de ruído.
 *
 * Configuração no painel: Integrações > Mecanismos de segurança >
 * Validação de saque via webhook (ver docs/ASAAS-SETUP.md).
 */

const MOTIVO =
  "Saques pela API estão bloqueados nesta conta (Provafix não faz saques).";

export async function POST(request: Request) {
  const corpo = (await request.json().catch(() => null)) as {
    type?: unknown;
    [objeto: string]: unknown;
  } | null;

  const tipo = typeof corpo?.type === "string" ? corpo.type : "";
  // O objeto da operação vem numa chave própria por tipo (transfer, bill,
  // pixQrCode…): pega o primeiro objeto do corpo para id e valor.
  const operacao = Object.values(corpo ?? {}).find(
    (v): v is Record<string, unknown> => typeof v === "object" && v !== null,
  );

  const esperado = process.env.ASAAS_SAQUE_TOKEN;
  const doAsaas = Boolean(
    esperado && request.headers.get("asaas-access-token") === esperado,
  );

  // Só identificadores e valor — sem dados bancários do destinatário.
  console.warn(
    JSON.stringify({
      webhook: "asaas-saque",
      recusado: true,
      doAsaas,
      tipo: tipo.slice(0, 40),
      id: typeof operacao?.id === "string" ? operacao.id.slice(0, 100) : undefined,
      valor: typeof operacao?.value === "number" ? operacao.value : undefined,
    }),
  );

  return Response.json({ status: "REFUSED", refuseReason: MOTIVO });
}

# Cobrança pelo Stripe

Assinaturas Pro e Team no cartão: checkout hospedado do Stripe, webhook que
ativa/renova/encerra o plano e portal do cliente (cartão, faturas, troca de
plano, cancelamento). Sem SDK — tudo em `src/lib/stripe.ts` (fetch).

Preços ficam em `PRECOS_CENTAVOS` (`src/lib/planos.ts`) e vão em cada
checkout (`price_data`): **não é preciso cadastrar produtos nem preços no
painel do Stripe**.

| Plano | Mensal | Anual (−20%) |
|---|---|---|
| Pro | R$ 22,90 | R$ 219,84 |
| Team | R$ 49,90 | R$ 479,04 |

## 1. Conta e chaves

1. Crie a conta em https://dashboard.stripe.com/register (pessoa física com
   CPF ou empresa com CNPJ) e complete a ativação (dados bancários para
   receber).
2. **Developers → API keys** → copie a **Secret key** (`sk_live_…`; em teste,
   `sk_test_…`). Nunca a coloque no código nem no chat.

## 2. Webhook

**Developers → Webhooks → Add endpoint**:

- URL: `https://provafix.up.railway.app/api/v1/webhook/stripe`
- Eventos:
  - `checkout.session.completed`
  - `invoice.paid`
  - `invoice.payment_failed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- Depois de criar, abra o endpoint e copie o **Signing secret** (`whsec_…`).

A rota confere a assinatura (`Stripe-Signature`, HMAC-SHA256, tolerância
de 5 min contra replay) sobre o corpo bruto. Em produção, sem
`STRIPE_WEBHOOK_SECRET` ela responde 503 e não aplica nada.

## 3. Portal do cliente

**Settings → Billing → Customer portal** → ative e salve. Recomendado:

- permitir atualizar cartão, ver faturas e cancelar (no fim do período);
- **não** permitir troca de plano pelo portal por enquanto (os metadados do
  plano vêm do checkout do Provafix).

## 4. Variáveis no Railway

| Variável | Valor |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_…` (ou `sk_test_…` para testar) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` do endpoint do passo 2 |

Sem `STRIPE_SECRET_KEY`, `POST /api/v1/checkout` responde 503
`PAGAMENTO_INDISPONIVEL` e o resto do app segue normal.

## 5. Testar antes de cobrar de verdade (modo de teste)

1. Use as chaves `sk_test_…` e um webhook criado no modo de teste.
2. No site: Preços → Assinar Pro → cartão `4242 4242 4242 4242`, validade
   futura, qualquer CVC.
3. Volta para `/perfil?assinatura=ok`; em segundos o plano vira Pro.
4. "Gerenciar assinatura" abre o portal; cancele e confira que o plano segue
   até a data de renovação.
5. Em dev, encaminhe eventos com o Stripe CLI:
   `stripe listen --forward-to localhost:3000/api/v1/webhook/stripe`.

Depois troque as duas variáveis pelas de produção (`sk_live_…` e o
`whsec_…` do webhook de produção).

## Como o plano acompanha os eventos

| Evento | Efeito |
|---|---|
| `checkout.session.completed` (pago) | ativa o plano, grava cliente/assinatura e o plano assinado |
| `invoice.paid` | estende até o fim do período da fatura (nunca encurta); devolve o plano se tinha expirado |
| `invoice.payment_failed` | status `past_due` (o plano segue até a data paga; o Stripe tenta de novo) |
| `customer.subscription.updated` | `cancel_at_period_end` → status `cancelada` (acesso até o fim do período) |
| `customer.subscription.deleted` | volta para Free e limpa a assinatura |

Idempotência: cada evento grava em `webhook_eventos` na mesma transação do
efeito — reenvio do Stripe não aplica duas vezes.

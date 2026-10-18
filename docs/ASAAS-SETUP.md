# Setup do Asaas (sandbox → produção)

## 1. Conta sandbox

Crie em **https://sandbox.asaas.com** (CPF basta, sem burocracia).
O painel sandbox é idêntico ao de produção, com dados fictícios.

## 2. Chave de API

Sandbox: **Conta > Integrações > Chave API** (começa com `$aact_...`).
Cole no `.env`:

```bash
ASAAS_API_KEY=sua_chave_sandbox_aqui
ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3
```

Sem chave, `POST /api/v1/checkout` responde `500 ASAAS_AUSENTE`
(degradação limpa — o resto do app funciona).

## 3. Webhook no painel

Sandbox: **Integrações > Webhook** — cadastre:

- URL: `https://seu-tunel/api/v1/webhook/asaas` (dev, via cloudflared)
- Eventos: `CHECKOUT_PAID`, `SUBSCRIPTION_CREATED`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`,
  `PAYMENT_OVERDUE`, `SUBSCRIPTION_DELETED`
- Token: gere um e cole no `.env` como `ASAAS_WEBHOOK_TOKEN`

Sem token configurado, a rota aceita chamadas locais (útil para
`scripts/simular-webhook-asaas.sh`); com token, o header
`asaas-access-token` precisa conferir.

## 4. Testar o checkout no sandbox

1. `npm run dev` → `/cadastro` → crie conta → `/perfil` → **assinar pro**.
2. O checkout do Asaas (sandbox) abre: use cartão de teste
   `4111 1111 1111 1111`, qualquer validade futura e CVV.
3. Sucesso volta para `/perfil?assinatura=ok`; o webhook ativa o **Pro**.
4. Simulação sem cartão:
   `bash scripts/simular-webhook-asaas.sh CHECKOUT_PAID <usuario_id> pro mensal`

## 5. Sandbox × produção

| | Sandbox | Produção |
|---|---|---|
| Base | `https://api-sandbox.asaas.com/v3` | `https://api.asaas.com/v3` |
| Chave | `$aact_...` de sandbox.asaas.com | chave de api.asaas.com |
| Cartão | `4111...` fictício | real |
| Conta | CPF basta | CPF ou CNPJ |

## 6. Migrar para produção

1. Conta em **https://api.asaas.com** (verificação da empresa).
2. Troque no `.env`: `ASAAS_BASE_URL=https://api.asaas.com/v3`,
   `ASAAS_API_KEY` (live) e `ASAAS_WEBHOOK_TOKEN` (novo, do painel live).
3. Cadastre o webhook live apontando para
   `https://seu-dominio/api/v1/webhook/asaas` com os 6 eventos.
   (Deploy automatizado: ver `docs/DEPLOY.md` — a URL final é
   `https://provafix.up.railway.app/api/v1/webhook/asaas`.)
4. Faça um checkout real de R$ 1 (ou trial) e confira o upgrade.
5. Preços ficam no código (`VALORES` em `lib/asaas.ts`) — sem price IDs.

## 7. Clientes e CPF

`criarCliente` envia nome + e-mail (+ cpfCnpj/phone quando houver). Se o
Asaas exigir `cpfCnpj` para o seu tipo de conta, a API devolve o erro
transparente (`502 CHECKOUT_FALHOU` com a mensagem) — nesse caso, colete
o CPF no cadastro (pendência documentada).

## 8. Trava de saques (validação de saque via webhook)

A `ASAAS_API_KEY` dá acesso à conta inteira. O Provafix só cobra
assinaturas e **nunca** pede saque, então a rota
`/api/v1/webhook/asaas/autorizacao-saque` responde `REFUSED` para toda
operação de saída (transferência, Pix, pagamento de conta, recarga…).
Com ela ligada, uma chave vazada não tira dinheiro da conta.

No painel: **Integrações > Mecanismos de segurança > Validação de saque
via webhook**:

- URL: `https://provafix.up.railway.app/api/v1/webhook/asaas/autorizacao-saque`
- E-mail: o seu (avisos de falha)
- Token: gere um e cole no Railway como `ASAAS_SAQUE_TOKEN` (diferente
  do `ASAAS_WEBHOOK_TOKEN`). A recusa não depende dele; ele só marca no
  log (`"doAsaas":true`) que a tentativa veio mesmo do Asaas.
- **Deixe desligadas** "validar operações feitas pela interface",
  "estornos Pix" e "Splits de pagamento": ligadas, elas passam a
  recusar também os seus saques manuais pelo painel/app.

Se a conta Asaas tiver outra integração que faça saques **pela API**,
eles também serão recusados — use uma conta separada para o Provafix.

Tentativa recusada vira log `{"webhook":"asaas-saque",...}` (só tipo,
id e valor). Ver com `railway logs --service laudo | grep asaas-saque`;
qualquer linha com `"doAsaas":true` = alguém usou a chave para sacar:
exclua a chave no painel e gere outra.

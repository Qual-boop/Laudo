# Setup do Stripe (modo teste)

## 1. Chaves

As chaves de teste já estão no `.env` (nunca commite — `.env` está no
`.gitignore`):

```bash
STRIPE_SECRET_KEY=sk_test_...          # Conta BR de teste (verificada)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Price IDs (criados via `npm run stripe:setup`, idempotente):

```bash
STRIPE_PRICE_PRO_MENSAL=price_...
STRIPE_PRICE_PRO_ANUAL=price_...
STRIPE_PRICE_TEAM_MENSAL=price_...
STRIPE_PRICE_TEAM_ANUAL=price_...
```

Produtos no dashboard (modo TESTE): 2 ativos — **Laudo Pro** (mensal +
anual) e **Laudo Team** (mensal + anual). Arquivados históricos ficam
invisíveis para checkout; não reative.

## 2. Recriar produtos (se precisar)

```bash
npm run stripe:setup
```

O script reaproveita o que já existe (busca por nome + confere
valor/intervalo/moeda) e imprime os Price IDs para colar no `.env`.

## 3. Webhook local (automatizado)

```bash
npm run stripe:webhook:start   # sobe o listen, captura o whsec_ e grava no .env
npm run stripe:webhook:stop    # para o listen
```

O script lê `STRIPE_SECRET_KEY` do `.env`, sobe
`stripe listen --forward-to localhost:3000/api/v1/webhook/stripe` em
background (PID em `/tmp/stripe-listen.pid`, log em
`/tmp/stripe-listen.log`), extrai o `whsec_...` e atualiza o `.env`
sozinho. **Reinicie o dev server** depois para carregar a variável.

Fluxo manual (se preferir): `stripe login` (abre o browser uma vez) e
`sh scripts/stripe-webhook.sh`.

## 4. Testar o fluxo completo no browser

1. `npm run dev` → http://localhost:3000
2. Crie uma conta em `/cadastro` (ou entre em `/login`).
3. Vá em `/perfil` → clique **assinar pro**.
4. O Stripe Checkout (teste) abre: pague com o cartão `4242 4242 4242 4242`,
   qualquer data futura e qualquer CVC.
5. Sucesso redireciona para `/perfil?assinatura=ok`.
6. Com o `stripe listen` rodando, o evento `checkout.session.completed`
   chega em `/api/v1/webhook/stripe` e o plano vira **Pro** sozinho.
7. Confirme o badge PRO no header e os limites liberados (`/api/v1/uso`).
8. Para cancelar: `/perfil` → **gerenciar** (Customer Portal) → cancela;
   o webhook `customer.subscription.deleted` volta a conta para Free.

## 5. Produção (quando sair do teste)

- [ ] Criar produtos/preços **live** no dashboard e trocar os 4 Price IDs
- [ ] Trocar `sk_test_`/`pk_test_` pelas chaves live
- [ ] Criar endpoint de webhook no dashboard apontando para
      `https://seu-dominio/api/v1/webhook/stripe` e usar o `whsec_` de lá
- [ ] `stripe listen` **não** é usado em produção

# Ambiente de desenvolvimento — Laudo

## Instalação única (só uma vez)

Nada além do repo: o Stripe não precisa de infra local (checkout e
webhook são HTTPS). Para receber webhooks em dev, use o Stripe CLI
(`stripe listen`, abaixo).

```bash
npm ci                  # dependências
npm run build           # build de produção (o e2e sobe ele local)
```

## Rotina diária

```bash
# Ligar a VM
npm run ambiente:iniciar   # dev + túnel (mostra o link público)
# ...trabalhar (link em /tmp/laudo-tunnel-url.txt)...
npm run ambiente:parar     # ao terminar
```

> Webhook do Stripe em dev (chaves de teste no `.env`):
> `stripe listen --forward-to localhost:3000/api/v1/webhook/stripe` e,
> noutro terminal, `stripe trigger checkout.session.completed`.
> Sem `STRIPE_WEBHOOK_SECRET` no `.env`, a rota de dev aceita sem assinatura.

## Diagnóstico

```bash
npm run ambiente:status    # dev? túnel? link?
```

## O que é automático

- **Nada no boot**: dev + cloudflared só sobem com `ambiente:iniciar`.
- O link do túnel muda a cada início — sempre copie o novo de
  `/tmp/laudo-tunnel-url.txt` (e atualize `AUTH_URL` se usar OAuth).

## E2E (16 checagens)

```bash
npm run build              # o e2e sobe o build de produção local
npm run e2e                # todos os 15 fluxos (cadastro → públicas)
npm run e2e:checkout       # só o fluxo 8
npm run e2e:auth           # só login cookie (fluxo 2)
bash scripts/e2e-completo.sh --apenas=limites  # qualquer fluxo pelo nome
```

O script sobe `next start` na porta 3456 (sem chaves de IA → fallback
determinístico), usa emails únicos com timestamp e **apaga todos os
usuários de teste no final** (trap). Fluxos com dependência (reteste,
certificado) criam as próprias fixtures — `--apenas` funciona isolado.

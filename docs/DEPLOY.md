# Deploy do Laudo (Railway + PostgreSQL + Asaas)

Produção: **https://provafix.up.railway.app**

Projeto Railway `laudo` (serviço `laudo` + plugin `Postgres`), deploy direto
pela CLI — sem CI. O runtime usa PostgreSQL (`DATABASE_URL` aponta para o
`postgres.railway.internal`); em desenvolvimento, sem `DATABASE_URL`, o app
cai no SQLite (`pentest.db`) automaticamente.

## Redeploy

```bash
railway link                       # uma vez: projeto laudo → serviço laudo → environment production
railway up --service laudo --ci    # build remoto (Nixpacks) + deploy
```

Antes de subir, rode localmente `npm test` e `npm run build`.
O CI do GitHub (`.github/workflows/ci.yml`) roda testes + build a cada
push e pull request — não publica nada.

## Variáveis do serviço `laudo`

Já configuradas: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `AUTH_SECRET`,
`AUTH_URL`, `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`, `AUTH_TRUST_HOST=true`,
`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `LAUDO_MODELO`, `LAUDO_MAX_TOKENS`,
`GROQ_API_KEY`, `GROQ_MODELO`, `GROQ_MAX_TOKENS`.

Faltam para cobrança: `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN`
(+ `ASAAS_BASE_URL=https://api.asaas.com/v3`).

```bash
railway variable set 'CHAVE=valor' --service laudo --skip-deploys
```

## Migrar dados locais (SQLite → PostgreSQL)

O Postgres não expõe URL pública por padrão; crie um TCP proxy (uma vez):

```bash
railway tcp-proxy create --port 5432 --service Postgres
```

Monte a URL com as variáveis do serviço (`PGUSER`, `PGPASSWORD`,
`PGDATABASE`, `RAILWAY_TCP_PROXY_DOMAIN`, `RAILWAY_TCP_PROXY_PORT` — veja
com `railway variable list --service Postgres --kv`) e rode:

```bash
DATABASE_URL='postgresql://...' npm run migrar-dados             # dry-run
DATABASE_URL='postgresql://...' npm run migrar-dados -- --executar
```

Idempotente (`ON CONFLICT DO NOTHING` + `setval` das sequences). Linhas
órfãs (FK apontando para usuário já apagado no SQLite) são puladas com
aviso — foi o caso do relatório de teste local.

Para abrir um psql direto: `railway connect Postgres`.

## Webhook do Asaas (produção)

- URL: `https://provafix.up.railway.app/api/v1/webhook/asaas`
- Eventos: `CHECKOUT_PAID`, `SUBSCRIPTION_CREATED`, `PAYMENT_RECEIVED`,
  `PAYMENT_OVERDUE`, `SUBSCRIPTION_DELETED`
- Token → variável `ASAAS_WEBHOOK_TOKEN` no Railway

Passo a passo com sandbox em `docs/ASAAS-SETUP.md`.

## Rollback

```bash
railway deployment list --service laudo   # histórico
railway down --service laudo -y           # remove o deploy mais recente (volta ao anterior)
```

O banco não sofre rollback — as migrações são aditivas.

## Notas

- Redirects de compatibilidade (`/api/gerar`, `/api/relatorios`,
  `/api/verificacao`) usam `Location` relativo de propósito: atrás do proxy
  do Railway, `request.url` chega como `localhost:8080` (ver
  `src/lib/compat-redirect.ts`).
- `metadataBase`/sitemap/robots apontam para `laudo.app` (placeholder) —
  trocar ao apontar um domínio próprio (CNAME → Railway).

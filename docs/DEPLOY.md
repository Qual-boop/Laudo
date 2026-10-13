# Deploy do Laudo (Vercel + Neon + Asaas)

O CI publica sozinho a cada push na branch principal. Você só precisa
fazer a **ligação das contas uma vez** (3 passos abaixo) — depois disso,
`git push` = site no ar.

## O que você precisa fazer (uma vez)

### 1. Criar as contas

- **Vercel**: https://vercel.com/signup (importe o repositório do GitHub).
- **Neon**: https://neon.tech → New Project (Postgres 16, região mais
  próxima, ex. `US East`) → copie a **Connection string**
  (`postgresql://...?sslmode=require`).

### 2. Adicionar os secrets no GitHub

Repo → **Settings → Secrets and variables → Actions → New secret**:

| Secret | Onde pegar |
|---|---|
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens → Create |
| `VERCEL_ORG_ID` | Vercel → Project → Settings → General (ou `vercel link` → `.vercel/project.json`) |
| `VERCEL_PROJECT_ID` | Idem acima |
| `DATABASE_URL` | Neon → Connection string (com `?sslmode=require`) |
| `ASAAS_API_KEY` | Produção: https://api.asaas.com → Integrações → Chave API |
| `ASAAS_WEBHOOK_TOKEN` | Produção: Integrações → Webhook → token gerado |
| `AUTH_SECRET` | Gere com `openssl rand -base64 32` |
| `OPENAI_API_KEY` | https://aistudio.google.com/apikey (Gemini) |
| `GROQ_API_KEY` | https://console.groq.com/keys (fallback) |

As mesmas variáveis devem existir em **Vercel → Project → Settings →
Environment Variables** (o `vercel pull` do workflow baixa de lá):

```
DATABASE_URL, ASAAS_API_KEY, ASAAS_BASE_URL=https://api.asaas.com/v3,
ASAAS_WEBHOOK_TOKEN, AUTH_SECRET, NEXT_PUBLIC_APP_URL=https://laudo.vercel.app,
OPENAI_API_KEY, OPENAI_BASE_URL, LAUDO_MODELO, GROQ_API_KEY, ...
```

### 3. Conectar o repositório na Vercel

Vercel → Add New → Project → Import do GitHub → Deploy. A partir daí o
workflow `.github/workflows/deploy.yml` assume (push → test → build →
`vercel deploy --prebuilt --prod`).

## Migrar os dados locais (uma vez)

```bash
# 1. Cole a DATABASE_URL do Neon no .env
# 2. Confira sem escrever:
npm run migrar-dados
# 3. Copia de verdade (idempotente — rodar 2x não duplica):
npm run migrar-dados -- --executar
```

Ordem: `usuarios → uso_mensal → sessoes → relatorios →
achados_verificacao → retestes → webhook_eventos`, com `setval()` das
sequences ao final. Detalhes em `scripts/migrar-dados.ts`.

## Webhook do Asaas (produção)

Após o primeiro deploy, cadastre no painel **live**
(https://api.asaas.com → Integrações → Webhook):

- URL: `https://laudo.vercel.app/api/v1/webhook/asaas`
- Eventos: `CHECKOUT_PAID`, `SUBSCRIPTION_CREATED`, `PAYMENT_RECEIVED`,
  `PAYMENT_OVERDUE`, `SUBSCRIPTION_DELETED`
- Token → secret `ASAAS_WEBHOOK_TOKEN` (GitHub + Vercel)

Passo a passo com sandbox em `docs/ASAAS-SETUP.md`.

## Como funciona o workflow

1. `npm ci` → instala exatamente o `package-lock.json`.
2. `npm test` → vitest + typecheck (165 testes). Falhou = sem deploy.
3. `npm run build` → build Next de produção. Quebrou = sem deploy.
4. `vercel pull` (env de produção) → `vercel build` → `vercel deploy
   --prebuilt --prod` → o que foi validado é o que sobe.

## Rollback

Vercel → Deployments → selecione o deploy anterior → **Promote to
Production**. O banco (Neon) não sofre rollback — a migração é só
aditiva (`CREATE TABLE IF NOT EXISTS` + `ON CONFLICT DO NOTHING`).

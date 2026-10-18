# Provafix

**Gerador de relatórios de pentest em segundos.** Transforme achados de teste em
relatórios profissionais com IA, certificados de correção, exportação para Jira/
GitHub e verificação de retestes.

| Recurso | Status |
| --- | --- |
| Landing page | ✅ Reposicionada para prova de correção |
| UI: header, toasts, skeleton, estados vazios | ✅ |
| Certificado de correção | ✅ |
| Exportação Jira e GitHub | ✅ |
| Relatório: resumo visual, matriz de risco, timeline | ✅ |
| Robustez: ErrorBoundary, 404, 500, loading | ✅ |
| Acessibilidade: aria-labels, focus-visible, labels de formulário | ✅ |
| Performance: lazy loading, sitemap, metadataBase | ✅ |
| Acessibilidade e SEO completos (Fase 7) | ✅ |
| Documentação + onboarding (Fase 8) | ✅ |
| Export por achado na Verificação (Fase 1) | ✅ |
| Multi-usuário JWT + API v1 (Fase 3) | ✅ |

![Status do build](https://img.shields.io/badge/build-passing-brightgreen) ![Licença](https://img.shields.io/badge/license-MIT-blue) ![Versão](https://img.shields.io/badge/version-0.2.0-purple) ![Next.js](https://img.shields.io/badge/Next.js-16-000) ![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8) ![Testes](https://img.shields.io/badge/tests-121-passing-green) ![Fases](https://img.shields.io/badge/fases-10%2F10-completed-brightgreen) ![Documentação](https://img.shields.io/badge/docs-4%2F4-brightgreen)

---

## O problema

Escrever relatório de pentest é a parte chata do trabalho. O teste leva horas; o
documento final leva dias. E o resultado quase nunca é reaproveitado.

## Stack técnica

| Camada | Tecnologia |
| --- | --- |
| Framework | [Next.js 16](https://nextjs.org) (App Router, Turbopack, React 19) |
| Linguagem | TypeScript 5 (modo `strict`) |
| Estilo | [Tailwind CSS 4](https://tailwindcss.com) (via `@tailwindcss/turbopack`, sem `tailwind.config.js`) |
| Tipografia | Geist Sans + Geist Mono |
| IA | Cadeia de provedores via API compatível com OpenAI: [Google Gemini](https://ai.google.dev/gemini-api) → [Groq](https://groq.com) → relatório local |
| Banco | SQLite via [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) |
| Testes | [Vitest](https://vitest.dev) |

> O projeto usa `better-sqlite3` diretamente. **Não há Prisma neste projeto.**

## Como rodar localmente

### Pré-requisitos

- Node.js 20 ou superior (testado no 22)
- npm 10 ou superior
- Uma chave da API do Gemini (gratuita em [aistudio.google.com/apikey](https://aistudio.google.com/apikey))

### Instalação

```bash
npm install
```

### Variáveis de ambiente

Crie um arquivo `.env` na raiz:

```bash
cp .env.example .env
```

| Variável | Obrigatória | Padrão | Descrição |
| --- | --- | --- | --- |
| `AUTH_SECRET` | sim (p/ login) | — | Segredo do JWT. Gere com `openssl rand -base64 32`. Sem ele, login e `/api/v1/*` falham. |
| `OPENAI_API_KEY` | sim | — | Chave da API. Sem ela o app monta o relatório localmente, sem enriquecimento por IA. |
| `OPENAI_BASE_URL` | não | `https://api.openai.com/v1` | Endpoint do provedor. Gemini: `https://generativelanguage.googleapis.com/v1beta/openai/` |
| `LAUDO_MODELO` | não | `gemini-3.8-flash` | Modelo usado para gerar o relatório. |
| `LAUDO_MAX_TOKENS` | não | `16000` | Limite de tokens da resposta. Relatórios completos precisam de folga. |
| `LAUDO_RETRY_BASE_MS` | não | `2000` | Espera base do backoff entre retentativas. |
| `GROQ_API_KEY` | não | — | Chave do Groq, **provedor secundário**. Sem ela só o Gemini é usado. |
| `GROQ_BASE_URL` | não | `https://api.groq.com/openai/v1` | Endpoint do Groq. |
| `GROQ_MODELO` | não | `openai/gpt-oss-120b` | Modelo do Groq. |
| `GROQ_MAX_TOKENS` | não | `6000` | Limite de tokens do Groq. |
| `ASAAS_API_KEY` | sim (p/ checkout) | — | Chave do Asaas (sandbox p/ teste). Sem ela, `/api/v1/checkout` responde `ASAAS_AUSENTE`. |
| `ASAAS_BASE_URL` | não | sandbox | `https://api.asaas.com/v3` em produção. |
| `ASAAS_WEBHOOK_TOKEN` | não (sim em prod) | — | Token do webhook; sem ele a rota aceita chamadas locais. |
| `ASAAS_SAQUE_TOKEN` | não (recomendado) | — | Token da trava de saques (`/api/v1/webhook/asaas/autorizacao-saque`, sempre `REFUSED`). |
| `DATABASE_URL` | sim (em prod) | — | Postgres (Neon). Sem ela, usa `pentest.db` local. |
| `NEXT_PUBLIC_APP_URL` | sim (em prod) | — | URL pública (redirects do checkout Asaas). |

Assinaturas via **Asaas** (checkout recorrente + webhook): guia em
[docs/ASAAS-SETUP.md](docs/ASAAS-SETUP.md), deploy em
[docs/DEPLOY.md](docs/DEPLOY.md).

### Comandos

```bash
npm run dev      # servidor de desenvolvimento em http://localhost:3000
npm run build    # build de produção
npm run start    # serve o build de produção
npm test         # suíte de testes (Vitest)
npm run limpar-banco  # APAGA TUDO do pentest.db (dev apenas)
```

O banco `pentest.db` é criado automaticamente na primeira execução.

> Sem conta? Abra http://localhost:3000 → redireciona para `/login` →
> crie a conta em `/cadastro`. A API (`/api/v1/*`) exige JWT: web usa o
> cookie de sessão, mobile/desktop usam `Authorization: Bearer` (ver
> [docs/API.md](docs/API.md)).

### Testando com um túnel

O `next.config.ts` já libera origens do Cloudflare Tunnel em desenvolvimento:

```bash
cloudflared tunnel --url http://localhost:3000
```

## Estrutura de pastas

```
src/
├── app/
│   ├── login/ + cadastro/        # Telas de acesso (Credentials + Google)
│   ├── api/auth/[...nextauth]/   # NextAuth v5 (sessão JWT)
│   ├── api/v1/                   # Backend de verdade (gerar, relatorios, verificacao, auth)
│   ├── api/                      # Legado: só redirect 308 → /api/v1/*
│   ├── layout.tsx            # Root layout: fontes, metadata + metadataBase, tema
│   ├── globals.css           # Tokens de tema (@theme) + focus-visible + impressão
│   ├── sitemap.ts            # Sitemap.xml gerado (/, /apresentacao)
│   ├── robots.ts             # Robots.txt (libera /, bloqueia /api/)
│   ├── icon.svg              # Favicon (escudo)
│   └── page.tsx              # Página principal: formulário + relatório (exige login)
├── middleware.ts             # Redirect / → /login; /login → / (logado)
├── components/
│   ├── Button, Card, Badge, Field, Alert, Spinner
│   ├── Onboarding.tsx        # Tour de 4 passos (lazy, dialog acessível)
│   ├── SeverityBadge.tsx     # Badge colorido por severidade
│   ├── TerminalBar.tsx       # Barra estilo terminal
│   ├── Logo.tsx              # Escudo SVG inline
│   └── relatorio/            # Componentes de renderização do relatório
│       ├── RelatorioView.tsx # Compõe o documento inteiro
│       ├── RelatorioCapa.tsx
│       ├── RelatorioSumario.tsx
│       ├── RelatorioEscopo.tsx
│       ├── RelatorioAchado.tsx
│       ├── RelatorioRecomendacoes.tsx
│       ├── RelatorioSkeleton.tsx
│       ├── Secao.tsx         # Cabeçalho numerado + blocos reutilizáveis
│       └── SeloCvss.tsx      # Badge de CVSS e de risco geral
└── lib/
    ├── db.ts                 # SQLite + schema multi-usuário (usuarios, sessoes)
    ├── auth/usuarios         # lib/usuarios.ts: criar/buscar/senha (bcrypt)
    ├── api-auth.ts           # exigirUsuario(): JWT via cookie ou Bearer
    ├── validacao.ts          # Esquemas Zod de todos os payloads da v1
    ├── ia.ts                 # Cadeia Gemini → Groq → fallback local
    ├── tipos.ts              # Tipos do relatório e da entrada do formulário
    └── relatorio.ts          # Prompt, normalizador e fallback local
docs/                         # API, arquitetura, segurança, guias
scripts/
└── limpar-banco.ts           # Apaga tudo (dev apenas): npm run limpar-banco
```

### Camadas

- **`app/`** — rotas. `page.tsx` é Client Component porque controla formulário e
  estado do relatório.
- **`app/api/`** — Legado: só redirect 308 → `/api/v1/*`. As rotas v1
  (`app/api/v1/`) são casca fina: auth (`exigirUsuario`), Zod e `Response.json`;
  a regra de negócio mora em `lib/`.
- **`lib/`** — lógica pura e testável, sem React. `relatorio.ts` concentra o
  prompt, o normalizador (que protege a UI de resposta malformada) e o fallback
  local que monta o relatório sem IA.
- **`components/`** — apresentação. `components/relatorio/` só renderiza; não
  contém lógica de negócio.

## Como o relatório é gerado

```
Formulário
   │  POST /api/gerar  { cliente, escopo, achados[] }
   ▼
Validação da entrada
   ▼
Prompt (lib/relatorio.ts)
   ▼
┌─ Cadeia de provedores ──────────────────────────────┐
│                                                     │
│  1. Gemini ──── falha (503 após retry) ────┐        │
│  2. Groq   ──── falha ──────────────────────┤        │
│  3. Relatório local (relatorioFallback) ◄───┘        │
│                                                     │
└─────────────────────────────────────────────────────┘
   ▼
Normalização (nunca lança)
   ▼
Relatorio com as 7 seções
```

Cada provedor tem **chave, URL, modelo e limite de tokens próprios**, e é
retentado até 4 vezes com backoff exponencial em status transitórios
(`408/409/425/429/5xx`). Erros permanentes — `404` de modelo descontinuado —
não são repetidos, porque não melhoram: a cadeia segue direto para o próximo.

Se todos falharem, o relatório local é entregue com o motivo de cada provedor
registrado em `sumarioExecutivo.visaoGeral`.

O normalizador garante que a UI nunca receba campo faltando, tipo trocado ou
número fora de faixa. `totalAchados`, `resumoPorSeveridade` e `riscoGeral` são
**derivados dos achados reais**, não lidos da resposta da IA.

## Exportação

O botão **Exportar PDF** usa `window.print()`. O CSS de impressão em
`globals.css` cuida de:

- inverter a paleta para fundo claro (o tema da tela é escuro);
- isolar a capa em uma página e forçar quebra por seção;
- impedir que um achado seja cortado no meio;
- repetir cabeçalho e rodapé em todas as páginas.

> O Chrome não implementa `counter(page)` em `@page`, então **numeração de página
> não aparece no PDF**. Cabeçalho e rodapé se repetem; a numeração exigiria uma
> geração de PDF no servidor.

## Contribuindo

Leia o [guia de contribuição](docs/CONTRIBUINDO.md) e a
[documentação de arquitetura](docs/ARQUITETURA.md).

```bash
git clone <url-do-repo>
cd relatorio-pentest
npm install
cp .env.example .env
npm test
npm run dev
```

Convenções: commits no padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/),
componentes pequenos e tipados, nenhuma lógica de negócio em `components/`.

## Roadmap (web → mobile → desktop)

- [x] Web multi-usuário com JWT + API `/api/v1/*`
- [x] Exportação por achado (Jira/GitHub/texto) na Verificação
- [ ] Assinaturas (Pro R$ 19,90 · Team R$ 49,90) + limites por plano
- [ ] Mobile (React Native + Expo) sobre a mesma `/api/v1/*` com Bearer
- [ ] Desktop (Tauri) sobre a mesma `/api/v1/*` com Bearer
- [ ] Trocar SQLite por Postgres/Turso + rate limiting no proxy

Detalhes da API em [docs/API.md](docs/API.md), segurança em
[docs/SEGURANCA.md](docs/SEGURANCA.md), arquitetura multi-cliente em
[docs/ARQUITETURA.md](docs/ARQUITETURA.md) (§7).

## Licença

MIT — veja [LICENSE](LICENSE).

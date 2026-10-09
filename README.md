# Laudo

**Gerador de relatórios de pentest com IA.** Transforme anotações de teste em um
relatório profissional completo — capa, sumário executivo, escopo e metodologia,
achados com CVSS e passos de reprodução, recomendações, conclusão e disclaimer —
pronto para entregar ao cliente.

<!-- Screenshot: adicione aqui a captura da tela principal.
     Sugestão: `docs/assets/laudo-relatorio.png` e referencie com
     `![Tela principal do Laudo](docs/assets/laudo-relatorio.png)` -->

![Status do build](https://img.shields.io/badge/build-passing-brightgreen) ![Licença](https://img.shields.io/badge/license-MIT-blue) ![Versão](https://img.shields.io/badge/version-0.2.0-purple) ![Next.js](https://img.shields.io/badge/Next.js-16-000) ![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8)

> Os badges acima usam URLs de exemplo. Troque pelo repositório real ao publicar.

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
| `OPENAI_API_KEY` | sim | — | Chave da API. Sem ela o app monta o relatório localmente, sem enriquecimento por IA. |
| `OPENAI_BASE_URL` | não | `https://api.openai.com/v1` | Endpoint do provedor. Gemini: `https://generativelanguage.googleapis.com/v1beta/openai/` |
| `LAUDO_MODELO` | não | `gemini-3.8-flash` | Modelo usado para gerar o relatório. |
| `LAUDO_MAX_TOKENS` | não | `16000` | Limite de tokens da resposta. Relatórios completos precisam de folga. |
| `LAUDO_RETRY_BASE_MS` | não | `2000` | Espera base do backoff entre retentativas. |
| `GROQ_API_KEY` | não | — | Chave do Groq, **provedor secundário**. Sem ela só o Gemini é usado. |
| `GROQ_BASE_URL` | não | `https://api.groq.com/openai/v1` | Endpoint do Groq. |
| `GROQ_MODELO` | não | `openai/gpt-oss-120b` | Modelo do Groq. |
| `GROQ_MAX_TOKENS` | não | `6000` | Limite de tokens do Groq. |

### Comandos

```bash
npm run dev      # servidor de desenvolvimento em http://localhost:3000
npm run build    # build de produção
npm run start    # serve o build de produção
npm test         # suíte de testes (Vitest)
```

O banco `pentest.db` é criado automaticamente na primeira execução.

### Testando com um túnel

O `next.config.ts` já libera origens do Cloudflare Tunnel em desenvolvimento:

```bash
cloudflared tunnel --url http://localhost:3000
```

## Estrutura de pastas

```
src/
├── app/
│   ├── layout.tsx            # Root layout: fontes, metadata, tema
│   ├── globals.css           # Tokens de tema (@theme) + regras de impressão
│   ├── icon.svg              # Favicon (escudo)
│   ├── page.tsx              # Página principal: formulário + relatório
│   └── api/
│       ├── gerar/route.ts    # POST: chama a IA e devolve o relatório
│       └── relatorios/
│           ├── route.ts      # POST (salva) e GET (lista)
│           └── [id]/route.ts # GET (recupera um relatório)
├── components/
│   ├── Button, Card, Badge, Field, Alert, Spinner
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
    ├── db.ts                 # Conexão SQLite e schema
    ├── tipos.ts              # Tipos do relatório e da entrada do formulário
    └── relatorio.ts          # Prompt, normalizador e fallback local
docs/                         # Arquitetura e guia de contribuição
```

### Camadas

- **`app/`** — rotas. `page.tsx` é Client Component porque controla formulário e
  estado do relatório.
- **`app/api/`** — Route Handlers. Validam a entrada, chamam a IA e devolvem
  JSON já normalizado.
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

## Licença

MIT — veja [LICENSE](LICENSE).

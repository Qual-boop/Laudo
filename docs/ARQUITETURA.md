# Arquitetura

Documento de referência do Laudo. Explica como as camadas se encaixam, por que
cada decisão foi tomada e como evoluir o contrato do relatório sem quebrar o app.

---

## 1. Visão geral

O Laudo é um App Router do Next.js com três camadas bem separadas:

```
┌─────────────────────────────────────────────────────────────┐
│  components/           apresentação, sem regra de negócio    │
│  app/page.tsx          estado do formulário + orquestração    │
└────────────────────────────┬────────────────────────────────┘
                             │ fetch POST /api/gerar
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  app/api/gerar/         valida entrada, chama IA, devolve   │
│  lib/relatorio.ts       JSON já normalizado                  │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP (API compatível OpenAI)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Gemini → modelo de linguagem                             │
└────────────────────────────┬────────────────────────────────┘
                             │ JSON cru, possivelmente quebrado
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  normalizarRelatorio()   coerção + validação                │
│  → Relatorio (tipo garantido)                              │
└────────────────────────────┬────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  components/relatorio/   renderiza o documento              │
│  RelatorioView.tsx       capa → sumário → escopo → achados  │
└─────────────────────────────────────────────────────────────┘
```

## 2. Fluxo detalhado de uma geração

```
1. Usuário preenche engagement + N achados em app/page.tsx
        │
        ▼
2. montarEntrada() monta RelatorioEntrada
        │
        ▼
3. POST /api/gerar
        │
        ├─► validarEntrada()  ──falha──► 400 { error } (nada de IA é chamada)
        │      • ao menos 1 achado com título ou descrição
        │      • severidade fora do enum vira "Media"
        │
        ▼
4. Sem OPENAI_API_KEY?  ──sim──► relatorioFallback() e devolve 200
        │ não
        ▼
5. montarPrompt() monta a instrução + os dados do usuário
        │
        ▼
6. cadeiaProvedores() monta a lista na ordem de preferência
        │   cada um com chave, URL, modelo e max_tokens próprios
        │
        ├──────────────┐
        ▼              │
   7. Gemini          │  chamarComRetry (4x, backoff 2s→4s→8s)
        │             │      ├─► ok ──────────────► segue
        │  falha ──────┘      ├─► rede caída ─────► próximo provedor
        ▼                    ├─► choices vazio ───► próximo provedor
   8. Groq                   ├─► content não JSON ► próximo provedor
        │                    └─► JSON sem achados ► próximo provedor
        │  falha
        ▼
   9. relatorioFallback(entrada, "todos os provedores falharam — …")
        │        cada motivo individual entra na visaoGeral
        ▼
  10. normalizarRelatorio(bruto, entrada)   ← só no caminho feliz
        │
        ▼
  11. setRelatorio() em app/page.tsx
        │
        ▼
  12. RelatorioView renderiza; "Exportar PDF" chama window.print()
```

O passo 7 nunca lança. O passo 9 nunca vê campo faltando.

## 3. Camadas

### `app/page.tsx` — orquestração

Client Component. Dono de todo o estado da tela:

| Estado | Papel |
| --- | --- |
| `eng` | metadados do engagement (cliente, escopo, período…) |
| `achados` | lista dinâmica `AchadoEntrada[]` |
| `relatorio` | `Relatorio \| null` — o documento pronto |
| `loading` / `salvando` | bloqueio de botão durante as chamadas |
| `erro` / `aviso` | mensagens inline (`Alert`) |

Handlers: `gerar()`, `salvar()`, `adicionarAchado()`, `removerAchado()`,
`atualizarAchado()`, `montarEntrada()`.

Regra: a página **valida o mínimo** e **desenha o máximo**. Validação real
acontece no servidor, porque é lá que a IA é chamada.

### `app/api/` — Route Handlers

| Rota | Método | Função |
| --- | --- | --- |
| `/api/gerar` | POST | Gera o relatório. Nunca devolve 5xx por falha de IA. |
| `/api/relatorios` | POST / GET | Salva o relatório completo; lista metadados. |
| `/api/relatorios/[id]` | GET | Recupera um relatório salvo. |

`/api/gerar` responde 200 mesmo quando a IA falha, devolvendo o relatório local.
A UI precisa de um documento de qualquer forma; um 500 deixaria o pentester sem
nada para entregar.

### `lib/` — lógica pura

Sem React, sem I/O de rede. Totalmente testável — é o único lugar onde há testes
unitários.

- **`tipos.ts`** — `Relatorio` (saída), `RelatorioEntrada` (entrada do
  formulário), `AchadoEntrada`, `ResumoRelatorio`. Contrato único compartilhado
  entre servidor e cliente.
- **`relatorio.ts`** — quatro responsabilidades:
  1. `montarPrompt()` — instrução para o modelo, incluindo o JSON de exemplo e
     as 12 regras de conteúdo.
  2. `normalizarRelatorio()` — transforma resposta arbitrária em `Relatorio`.
  3. `relatorioFallback()` — monta o documento sem IA.
  4. `contarPorSeveridade()` / `riscoGeralDe()` — derivações.
- **`db.ts`** — conexão `better-sqlite3` e `CREATE TABLE IF NOT EXISTS`.

### `components/` — apresentação

- `Button`, `Card`, `Badge`, `Field`, `Alert`, `Spinner`, `SeverityBadge`,
  `TerminalBar`, `Logo` — genéricos.
- `components/relatorio/` — **só renderizam**. Cada componente recebe dados
  prontos e não calcula nada de negócio. É por isso que a formatação de
  severidade mora em `SeverityBadge` e não no `AchadoCard`.

## 4. Decisões de design

### Por que SQLite (`better-sqlite3`) e não Prisma

O relatório é **um documento JSON**. Relatórios não precisam de consulta
relacional complexa, não há join, não há paginação. Prisma traria um client
gerado, um engine binário e uma camada de migração para resolver duas queries.

`better-sqlite3` é síncrono (elimina async desnecessário), tem zero dependências
nativas além do binding, e o schema cabe em uma tabela:

```sql
CREATE TABLE IF NOT EXISTS relatorios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente TEXT NOT NULL,
  titulo TEXT NOT NULL,
  data TEXT NOT NULL,
  versao TEXT NOT NULL,
  risco_geral TEXT NOT NULL,
  total_achados INTEGER NOT NULL,
  relatorio_json TEXT NOT NULL,   -- o documento inteiro
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);
```

Os campos indexados existem só para a listagem; o conteúdo vive no JSON.

> Decisão revisável: se surgir busca por texto dentro de achados ou histórico de
> versões, aí sim vale migrar.

### Por que um provedor compatível com a API da OpenAI

- Compatível com a API da OpenAI — trocar de provedor é mudar `OPENAI_BASE_URL`.
- **Provedor atual: Google Gemini** (`gemini-3.8-flash`), via a camada
  `generativelanguage.googleapis.com/v1beta/openai/`.
- **Limite de tokens:** `max_tokens` teve de subir de 3000 para 16000. Um
  relatório com vários achados estoura 3000 com facilidade e o modelo devolve
  JSON truncado — que o normalizador não recupera, então a rota cai no fallback.

### Por que existe retentativa (`chamarComRetry`)

O Gemini responde `503 "high demand"` com frequência mesmo no plano gratuito,
e o erro atinge qualquer modelo disponível da conta. Em medição real, 3 de 4
chamadas consecutivas receberam 503.

Por isso a rota repete a chamada até 4 vezes em status transitórios
(`408, 409, 425, 429, 500, 502, 503, 504`) com backoff exponencial e jitter
(2s → 4s → 8s). Erros permanentes — `400` de modelo inexistente, `404` de modelo
descontinuado — **não** são repetidos, porque não melhoram.

Isso não substitui o fallback: se as 4 tentativas falharem, o relatório local é
entregue com o motivo registrado. Os dois mecanismos são complementares —
a retentativa evita cair no fallback em falhas curtas; o fallback garante que
exista um documento quando o provedor está fora.

### Modelos descontinuados (histórico)

| Modelo | Status em 2026-10 |
| --- | --- |
| `openai/gpt-oss-20b` (Groq) | anterior ao projeto |
| `gemini-2.5-flash` | `404` — descontinuado, redireciona para `gemini-3.8-flash` |
| `gemini-2.5-pro` | `404` — descontinuado |
| `gemini-2.5-flash-lite` | `404` — descontinuado |

Quando trocar de modelo, atualize `LAUDO_MODELO` **e** `MODELO_PADRAO` em
`src/app/api/gerar/route.ts` — o segundo é o que vale quando a variável de
ambiente não está definida.

### Por que existe a cadeia de provedores

O Gemini responde `503 "high demand"` em ~75% das chamadas na conta gratuita.
Com um provedor só, três de cada quatro gerações caíam no relatório local — o
app "funcionava", mas perdia o valor da IA quase sempre.

A cadeia resolve isso sem mudar o contrato do relatório:

| Nível | Provedor | Variáveis | Quando entra |
| --- | --- | --- | --- |
| 1 | Gemini | `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `LAUDO_MODELO`, `LAUDO_MAX_TOKENS` | sempre que a chave existir |
| 2 | Groq | `GROQ_API_KEY`, `GROQ_BASE_URL`, `GROQ_MODELO`, `GROQ_MAX_TOKENS` | quando o Gemini falha de verdade |
| 3 | Relatório local | — | quando não há chave, ou todos falharam |

Um provedor sem chave configurada é **omitido** da cadeia — não é um erro. Com
só o Gemini configurado o comportamento é idêntico ao de um provedor único, e
com nenhuma chave o app nem toca na rede.

O motivo de cada falha entra em `sumarioExecutivo.visaoGeral`, então o
pentester sabe se foi 503 do Gemini, 404 de modelo morto, ou rede caída:

> `Relatório montado localmente — motivo: todos os provedores falharam —
> Gemini: respondeu HTTP 503 · Groq: falha de comunicação (fetch failed)`

### Por que existe o fallback local

Três motivos independentes:

1. **Chave ausente** — o app precisa funcionar no primeiro `git clone`.
2. **Modelo alucina** — mesmo com prompt forte, o modelo pode devolver prosa em
   vez de JSON. Sem fallback, o pentester fica sem documento.
3. **Fallback é teste** — `relatorioFallback()` alimenta metade da suíte de
   testes e é o caminho garantido de que sempre existe um relatório válido.

O motivo da queda fica gravado em `sumarioExecutivo.visaoGeral`
("Relatório montado localmente — motivo: …"), para o usuário saber por quê.

### Por que os contadores são derivados, não lidos da IA

Em teste real, a IA escreveu "duas vulnerabilidades críticas" quando havia uma
crítica e uma baixa. Modelos de linguagem narram mal contagens.

Então `normalizarRelatorio()` **ignora** `totalAchados` e `resumoPorSeveridade`
da resposta e recalcula a partir de `achados[]`. A prosa continua podendo errar —
é o que o pentester revisa — mas os números displayed estão sempre certos.

### Por que `@theme` e não `@theme inline`

No Tailwind 4, `@theme inline` **substitui** a variável pelo valor literal na
utility gerada (`.bg-superficie{background-color:#111820}`). Isso impede
sobrescrever cores no `@media print`, e sem isso o PDF sairia com fundo escuro.

Com `@theme` puro, a utility referencia `var(--color-superficie)` e o bloco
`@media print` redefine a paleta inteira trocando ~12 variáveis.

## 5. Como adicionar um campo ao relatório

Exemplo: adicionar `responsavel` (nome de quem	o achado) em cada achado.

### Passo 1 — Tipos (`src/lib/tipos.ts`)

```ts
export type Achado = {
  // ...
  responsavel: string;   // ← novo
};
```

### Passo 2 — Prompt (`montarPrompt` em `src/lib/relatorio.ts`)

Atualize o JSON de exemplo **e** as regras:

```ts
"descricaoTecnica": string,
"responsavel": string,          // ← novo
```

E acrescente uma regra, por exemplo:

> 13. "responsavel" deve ser preenchido com o nome do pentester
> responsável, ou "Não atribuído".

### Passo 3 — Normalizador

```ts
responsavel: txt(a.responsavel, "Não atribuído"),
```

> Use sempre `txt(valor, padrão)` ou `lista(valor)`. Nunca confie no formato:
> o modelo pode devolver `null`, número ou objeto. É exatamente o que a suíte
> de testes cobre.

### Passo 4 — Fallback

```ts
responsavel: "Não atribuído",
```

### Passo 5 — Componente (`components/relatorio/RelatorioAchado.tsx`)

```tsx
{dados.responsavel && (
  <Bloco titulo="responsável">{dados.responsavel}</Bloco>
)}
```

### Passo 6 — Testes

`src/lib/relatorio.test.ts`:
- adiciona `responsavel` ao `JSON_VALIDO` e no objeto de entrada degradada;
- confirma o fallback quando o campo vem `null`.

`src/lib/tipos.test-d.ts`:
- adiciona `responsavel: string` ao `toEqualTypeOf<Achado>()`.

### Passo 7 — Validação

```bash
npm test        # 66 testes
npm run build   # TypeScript estrito
```

### Checklist

- [ ] `tipos.ts` atualizado
- [ ] prompt com exemplo **e** regra
- [ ] normalizador com valor padrão
- [ ] fallback local
- [ ] componente que renderiza
- [ ] testes de runtime e de tipo
- [ ] `npm test` + `npm run build` verdes

## 6. Onde mexer para cada coisa

| Coisa | Arquivo |
| --- | --- |
| Cor, grid de fundo, CSS de impressão | `src/app/globals.css` |
| Prompt e instruções de conteúdo | `montarPrompt()` em `lib/relatorio.ts` |
| Schema do banco | `src/lib/db.ts` |
| Cadeia de provedores | `cadeiaProvedores()` e `tentarProvedor()` em `lib/ia.ts` |
| Validação de payloads | esquemas Zod em `lib/validacao.ts` |
| Auth (quem é o usuário) | `exigirUsuario()` em `lib/api-auth.ts` |
| Usuários (criar/buscar/senha) | `lib/usuarios.ts` |
| Modelo e limite de tokens | env `LAUDO_MODELO`/`GROQ_MODELO`, `LAUDO_MAX_TOKENS`/`GROQ_MAX_TOKENS` |
| Domínios liberados em dev | `next.config.ts` (`allowedDevOrigins`) |

---

## 7. Multi-cliente e multi-usuário (SaaS)

A API é tratada como **backend de verdade**: os mesmos endpoints servem o
web atual, o futuro mobile (React Native + Expo) e o futuro desktop (Tauri).

```
┌──────────────┐  cookie de sessão   ┌────────────────────────────┐
│  Web (Next)  │ ──────────────────► │                            │
└──────────────┘                     │  /api/v1/*  (JSON puro)    │
┌──────────────┐  Authorization:     │                            │
│  Mobile      │  Bearer <jwt> ────► │  exigirUsuario() → JWT      │
└──────────────┘                     │  (cookie OU Bearer)        │
┌──────────────┐  Authorization:     │       │                    │
│  Desktop     │  Bearer <jwt> ────► │       ▼                    │
└──────────────┘                     │  lib/* (regra de negócio)  │
                                     │       │                    │
                                     │       ▼                    │
                                     │  SQLite (usuario_id em     │
                                     │  tudo; sessoes p/ mobile)  │
                                     └────────────────────────────┘
```

### Por que NextAuth v5 com sessão JWT

- Um token só para os 3 clientes: o web usa o cookie httpOnly, mobile e
  desktop usam o mesmo JWT via `Authorization: Bearer` (`getToken` lê os
  dois — verificado no código do `@auth/core`).
- Tokens mobile (`POST /api/v1/auth/token`) carregam `sid` e ficam
  registrados em `sessoes`, permitindo **revogação** (`DELETE .../token`).
- Login Google opcional (só aparece com `GOOGLE_CLIENT_ID` configurado);
  Credentials com bcrypt sempre funciona.

### Por que o middleware não usa `auth()`

O `auth()` do NextAuth puxa a config inteira para o bundle Edge — e a
config referencia `@/lib/usuarios` → `better-sqlite3` (nativo Node),
quebrando o build. O `src/middleware.ts` usa `getToken` do `next-auth/jwt`
(jose, Edge-safe) só para decidir redirects de **páginas**; a API responde
401 JSON dentro de cada rota via `exigirUsuario()`.

### Regras para novos endpoints

1. Criar em `/api/v1/*`, nunca em `/api/*` (o legado é só redirect 308).
2. Validar payload com Zod (`lib/validacao.ts`) → 400 `{ error, code: "VALIDACAO", detalhes }`.
3. Chamar `exigirUsuario(request)` primeiro → 401 sozinho.
4. Filtrar tudo por `usuario_id`; recurso alheio → 403 `{ code: "ACESSO_NEGADO" }`.
5. Lógica em `lib/`; a rota é só casca HTTP (`Response.json`).
6. Documentar em `docs/API.md` com exemplo curl.

### Preparação para React Native e Tauri

- Nada no backend depende de cookie: qualquer cliente autentica com
  `POST /api/v1/auth/token` e usa Bearer em tudo.
- Payloads e erros são JSON estável com `code` — o mobile pode trocar
  mensagens sem quebrar parsing.
- Quando o SQLite estourar (multi-dispositivo, concorrência), a troca é
  só em `lib/db.ts` + driver; as queries já usam `usuario_id` e placeholders.

# Guia de contribuição

Obrigado por querer ajudar. Este guia cobre ambiente, padrões de código, testes e
commits.

Antes de mexer em qualquer coisa, leia também o
[documento de arquitetura](ARQUITETURA.md) — ele explica por que o projeto é
organizado assim.

---

## 1. Ambiente

### Pré-requisitos

- Node.js 20+ (testado no 22)
- npm 10+

### Configuração

```bash
git clone <url-do-repo>
cd relatorio-pentest
npm install
cp .env.example .env
```

Edite `.env` e preencha:

```bash
OPENAI_API_KEY=sua-chave          # https://console.groq.com/keys (gratuita)
OPENAI_BASE_URL=https://api.groq.com/openai/v1
LAUDO_MODELO=openai/gpt-oss-20b
LAUDO_MAX_TOKENS=16000
```

Sem `OPENAI_API_KEY` o app **ainda funciona**: monta o relatório localmente, sem
enriquecimento por IA. Útil para desenvolver a interface sem gastar cota.

### Comandos

```bash
npm run dev         # http://localhost:3000
npm run build       # build de produção
npm run start       # serve o build
npm test            # testes + checagem de tipos
npm run test:watch  # testes em watch mode
```

O `pentest.db` é criado sozinho na primeira execução e está no `.gitignore`.

## 2. Padrões de código

### Onde cada coisa vive

```
app/        rotas e APIs — nada de lógica de negócio
components/ apresentação — nada de I/O
lib/        regras de negócio — sem React, sem rede
```

Regra prática: **se precisa ser testado sem renderizar, vai para `lib/`.**

### Nomenclatura

| Coisa | Convenção | Exemplo |
| --- | --- | --- |
| Arquivos | kebab-case (componentes) | `SeverityBadge.tsx` |
| Componentes | PascalCase | `RelatorioCapa` |
| Funções/variáveis | camelCase | `normalizarRelatorio` |
| Types/interfaces | PascalCase | `Relatorio`, `AchadoEntrada` |
| Constantes | SCREAMING_SNAKE | `ACHADO_VAZIO`, `SEVERIDADES` |
| Handlers de evento | `nomeDaAção` | `adicionarAchado`, `removerAchado` |
| Arquivos de teste | `X.test.ts` / `X.test-d.ts` | `relatorio.test.ts` |

### Idioma

- **Código, nomes e comentários: português.**
- **Strings de interface: português do Brasil.**

### Componentes

- Função com `export function`, sem `React.FC`.
- Props sempre tipadas e explícitas.
- Sem lógica de negócio: se precisa calcular, sobe para `lib/` ou para o pai.
- Classes de Tailwind direto no JSX. A única exceção são os tokens em
  `globals.css` (`@theme`) e o bloco `@media print`.

### Estado

- Estado de formulário vive em `app/page.tsx`.
- Estado derivado é calculado no render, não guardado em `useState`.
- Nada de biblioteca de estado global — o app é pequeno demais para justificar.

### Tipos

- `strict` está ligado. Não use `any`; se precisar, use `unknown` e coaja.
- Never `!` em dados vindos da IA — passe por `txt()` / `lista()` / `obj()`.

### Ao tocar em `lib/relatorio.ts`

É o arquivo mais sensível do projeto.

- **Toda** saída da IA passa por `normalizarRelatorio()`.
- Valores novos **precisam** de um valor padrão — a IA pode devolver qualquer
  coisa, e um `undefined` quebraria a renderização.
- Se mudar a estrutura do relatório, atualize o prompt, o normalizador, o
  fallback **e** os testes, nessa ordem. A suíte existe para pegar o que você
  esqueceu.

## 3. Testes

```bash
npm test                    # tudo
npm run test:watch          # em watch
npx vitest run src/lib      # só um diretório
npx vitest run -t "fallback"  # só um teste, por nome
```

Três arquivos de teste:

| Arquivo | Tipo | O que cobre |
| --- | --- | --- |
| `src/lib/relatorio.test.ts` | runtime | normalização, coerção, fallback |
| `src/app/api/gerar/route.test.ts` | runtime | cada modo de falha da rota |
| `src/lib/tipos.test-d.ts` | **tipo** | o contrato de `tipos.ts` |

`npm test` roda `vitest run --typecheck`: os testes de tipo são validados pelo
TypeScript, não em runtime.

### Ao escrever teste

- Nome em português descrevendo o **comportamento**, não a função:
  `"cai no padrão quando a string é vazia"`, não `"testa txt"`.
- Quando corrigir um bug, escreva o teste que **falha antes** da correção e
  comente o porquê com `// Regressão: ...`.
- Teste casos degradados: `null`, `undefined`, tipo errado, string vazia,
  objeto vazio. É o que a IA realmente devolve.

## 4. Commits

[Conventional Commits](https://www.conventionalcommits.org/pt-br/).

```
<tipo>(<escopo>): <descrição em minúscula>
```

**Tipos**

| Tipo | Uso |
| --- | --- |
| `feat` | functionality nova |
| `fix` | correção de bug |
| `docs` | documentação |
| `test` | testes |
| `refactor` | reorganização sem mudar comportamento |
| `style` | formatação |
| `perf` | performance |
| `chore` | manutenção |

**Escopos usados:** `docs`, `test`, `feat`, `fix`, `ui`, `api`, `lib`, `deps`.

**Exemplos**

```bash
feat(ui): botão de duplicar achado
fix(lib): normalizar severidade com acento
docs: explicar o fluxo de geração
test: cobrir fallback sem chave de API
refactor(lib): extrair coerção de tipos
```

Escopos são opcionais, mas prefira usá-los neste projeto.

## 5. Antes de abrir o PR

```bash
npm test        # precisa passar inteiro
npm run build   # precisa passar
```

Checklist:

- [ ] `npm test` verde
- [ ] `npm run build` verde
- [ ] `npx tsc --noEmit` sem erros
- [ ] Nenhum `console.log` de debug esquecido
- [ ] Nenhum `any` novo
- [ ] `.env` **não** foi commitado
- [ ] Mudança em `lib/relatorio.ts` tem testes novos
- [ ] Campos novos na UI funcionam com o fallback (sem IA)

## 6. Dúvidas

- **"Preciso de um campo novo no relatório"** → seção 5 do
  [ARQUITETURA.md](ARQUITETURA.md), tem o passo a passo.
- **"A IA devolveu algo quebrado"** → rode `npm test`; quase sempre é um `txt()`,
  `lista()` ou um `default` faltando no normalizador.
- **"Quero trocar o provedor de IA"** → mude `OPENAI_BASE_URL`. A API é
  compatível com OpenAI.

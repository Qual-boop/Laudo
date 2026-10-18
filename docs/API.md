# API do Laudo — `/api/v1/*`

Backend JSON puro, versionado desde a v1. Os mesmos endpoints servem o web
(Next.js), o futuro app mobile (React Native + Expo) e o futuro desktop
(Tauri). Rotas antigas (`/api/gerar`, `/api/relatorios`, `/api/verificacao`)
respondem **308** para o equivalente `/api/v1/*` (método e corpo preservados).

Base local: `http://localhost:3000`

## Autenticação (JWT — o mesmo token nos 3 clientes)

Sessão JWT do NextAuth v5. Dois transportes aceitos em toda rota protegida:

| Cliente | Como envia |
|---|---|
| Web | cookie de sessão (o `fetch` same-origin envia sozinho) |
| Mobile / desktop | header `Authorization: Bearer <jwt>` |

### Criar conta

```bash
curl -X POST http://localhost:3000/api/v1/auth/cadastro \
  -H 'Content-Type: application/json' \
  -d '{"nome":"Maria","email":"maria@consultoria.com","senha":"segredo-123"}'
# 201 {"id":1,"nome":"Maria","email":"maria@consultoria.com"}
# 409 {"error":"Este e-mail já está em uso.","code":"EMAIL_EM_USO"}
# 429 {"error":"Muitas tentativas...","code":"MUITAS_TENTATIVAS"} + Retry-After
```

Regras: nome 1–120 chars, e-mail válido, senha 8–128 chars. Senha guardada
só como hash bcrypt (custo 12). E-mail único (case-insensitive).

### Limite de tentativas

Login web, token e cadastro respondem **429** com `Retry-After` (segundos)
quando estouram: login e token dividem o contador (30 por IP e 10 por e-mail
a cada 15 min; login certo zera o do e-mail); cadastro, 20 por IP e 5 por
e-mail por hora.

### Login web

Via NextAuth (`signIn("credentials")` nas telas `/login` e `/cadastro`, ou
botão Google quando `GOOGLE_CLIENT_ID` configurado). Sessão de 30 dias.

### Login mobile/desktop (token bruto)

```bash
curl -X POST http://localhost:3000/api/v1/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"email":"maria@consultoria.com","senha":"segredo-123"}'
# 200 {"token":"eyJ...","expiraEm":"2026-11-09T..."}
# 401 {"error":"E-mail ou senha inválidos.","code":"CREDENCIAIS_INVALIDAS"}
# 429 {"error":"Muitas tentativas...","code":"MUITAS_TENTATIVAS"} + Retry-After
```

Use o `token` em `Authorization: Bearer`. A sessão fica registrada e pode
ser revogada (logout):

```bash
curl -X DELETE http://localhost:3000/api/v1/auth/token \
  -H 'Authorization: Bearer eyJ...'
# 200 {"ok":true}
```

## Endpoints

Todos exigem auth (exceto os de `/api/v1/auth/*`). Multi-tenant: cada query
filtra por `usuario_id` do JWT. Planos: `free` (3 relatórios/mês, 5 achados,
10 retestes, sem Jira/GitHub nem certificado), `pro` e `team` ilimitados.
Limite atingido → **402** `{ error, code: "LIMITE_PLANO", recurso, usados, limite }`.

### `GET /api/v1/uso` — plano + consumo do mês

```bash
curl http://localhost:3000/api/v1/uso -H 'Authorization: Bearer eyJ...'
# 200 {"plano":"free","mes":"2026-10","relatorios":{"usados":2,"limite":3},...}
```

### `GET /api/v1/assinatura` — plano efetivo (+ trial/expiração)

```bash
curl http://localhost:3000/api/v1/assinatura -H 'Authorization: Bearer eyJ...'
# 200 {"plano":"pro","expiraEm":null,"subscriptionId":"sub_...","trial":false}
```

### `POST /api/v1/assinatura/testar-pro` — trial Pro 30 dias, sem cartão

Uma vez por conta free. `201 {"plano":"pro","expiraEm":"...","trial":true}`.

### `POST /api/v1/checkout` — checkout recorrente (Asaas)

```bash
curl -X POST http://localhost:3000/api/v1/checkout \
  -H 'Authorization: Bearer eyJ...' -H 'Content-Type: application/json' \
  -d '{"plano":"pro","periodo":"mensal"}'
# 200 {"url":"https://sandbox.asaas.com/checkoutSession/show/..."}
```

Cria o cliente no Asaas na primeira vez (nome + e-mail) e devolve o link
de pagamento (cartão). Sem `ASAAS_API_KEY` → 500 `ASAAS_AUSENTE`.

### `POST /api/v1/assinatura/cancelar` — cancela no Asaas e volta p/ free

`200 {"ok":true,"plano":"free"}`. Sem assinatura → 409.

### `POST /api/v1/webhook/asaas` — webhook (idempotente)

Eventos: `CHECKOUT_PAID` (ativa), `SUBSCRIPTION_CREATED` (salva id),
`PAYMENT_RECEIVED` (renova ciclo), `PAYMENT_OVERDUE` (marca `past_due`
sem cancelar), `SUBSCRIPTION_DELETED` (volta p/ free). Sempre 200;
repetidos são ignorados (`webhook_eventos`). Com `ASAAS_WEBHOOK_TOKEN`
configurado, exige header `asaas-access-token`.

### `POST /api/v1/gerar` — gerar relatório via IA

```bash
curl -X POST http://localhost:3000/api/v1/gerar \
  -H 'Authorization: Bearer eyJ...' -H 'Content-Type: application/json' \
  -d '{"cliente":"Acme","achados":[{"titulo":"SQLi no login","severidade":"Critica"}]}'
# 200 { capa, sumarioExecutivo, escopoMetodologia, achados, ... }
```

Limites: máx. 50 achados, 20.000 chars por texto livre. Sem chave de IA
configurada, devolve o relatório local (fallback, 200).

### `POST /api/v1/relatorios` — salvar relatório

```bash
curl -X POST http://localhost:3000/api/v1/relatorios \
  -H 'Authorization: Bearer eyJ...' -H 'Content-Type: application/json' \
  -d '{"capa":{...},"achados":[...]}'
# 201 {"id":4,"achados":4}
```

Salva relatório + achados verificáveis na mesma transação.

### `GET /api/v1/relatorios` — listar meus relatórios

```bash
curl 'http://localhost:3000/api/v1/relatorios?limit=20&page=1' \
  -H 'Authorization: Bearer eyJ...'
# 200 [{ id, cliente, titulo, data, versao, risco_geral, total_achados, ... }]
```

`limit` 1–200 (padrão 50), `page` ≥ 1 (padrão 1).

### `GET /api/v1/relatorios/[id]` — abrir um relatório

```bash
curl http://localhost:3000/api/v1/relatorios/4 -H 'Authorization: Bearer eyJ...'
# 200 { relatório completo }
# 403 {"error":"Acesso negado a este relatório.","code":"ACESSO_NEGADO"}
```

### `GET /api/v1/verificacao` — achados verificáveis

```bash
curl 'http://localhost:3000/api/v1/verificacao?limit=50' \
  -H 'Authorization: Bearer eyJ...'
# 200 [{ id, achado_ref, titulo, status, ultimo_reteste, ... }]
```

Filtro opcional `?achadoId=7`.

### `POST /api/v1/verificacao` — registrar reteste

```bash
curl -X POST http://localhost:3000/api/v1/verificacao \
  -H 'Authorization: Bearer eyJ...' -H 'Content-Type: application/json' \
  -d '{"achadoId":7,"resultado":"corrigido","evidencia":"POST /login → 400","dataReteste":"2026-10-21"}'
# 201 {"retesteId":9,"status":"verificado","achado":{...}}
```

`resultado ∈ corrigido, nao-corrigido, parcial` (parcial não verifica).
`dataReteste` opcional (YYYY-MM-DD, padrão: hoje). Evidência obrigatória.

### `DELETE /api/v1/verificacao?achadoId=7` — reabrir achado

Apaga os retestes e volta para `pendente`. `200 {"ok":true,"achadoId":7}`.

## Códigos de erro

Toda falha de API retorna `{ error: string, code: string }`:

| HTTP | `code` | Quando |
|---|---|---|
| 400 | `VALIDACAO` | payload inválido (`+ detalhes: [{campo, mensagem}]`) |
| 400 | `JSON_INVALIDO` | corpo não é JSON |
| 400 | `ACHADOID_AUSENTE/INVALIDO` | DELETE sem `?achadoId=` válido |
| 401 | `NAO_AUTENTICADO` | sem token |
| 401 | `TOKEN_INVALIDO` | token ilegível |
| 401 | `SESSAO_INVALIDA` | Bearer expirado ou revogado |
| 401 | `CREDENCIAIS_INVALIDAS` | login errado (genérico de propósito) |
| 403 | `ACESSO_NEGADO` | recurso de outro usuário |
| 404 | `NAO_ENCONTRADO` | relatório/achado inexistente |
| 405 | `METODO_INVALIDO` | método errado na rota |
| 409 | `EMAIL_EM_USO` | cadastro duplicado |
| 500 | `AUTH_INDISPONIVEL` | `AUTH_SECRET` ausente no servidor |
| 500 | `DADO_CORROMPIDO` | JSON do relatório ilegível no banco |

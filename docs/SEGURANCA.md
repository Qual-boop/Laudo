# Segurança — Laudo

## Política de senha

- Mínimo 8, máximo 128 caracteres (validação Zod no cadastro e no login).
- Armazenada **só como hash bcrypt** (custo 12; `BCRYPT_ROUNDS` baixo só em
  teste). Nunca em plaintext, nunca em log.
- E-mail único case-insensitive. Cadastro duplicado → 409, sem vazar se o
  e-mail existe em outros fluxos (login responde sempre "E-mail ou senha
  inválidos").

## Como funciona o JWT

- NextAuth v5, `session.strategy: "jwt"`, segredo em `AUTH_SECRET`
  (gere com `openssl rand -base64 32`; obrigatório em produção).
- Validade de 30 dias, tanto na sessão web (cookie httpOnly) quanto no
  token mobile (`POST /api/v1/auth/token`).
- O payload carrega `usuarioId` (+ `sid` nos tokens mobile). Toda rota
  `/api/v1/*` (exceto auth) passa por `exigirUsuario()`: decodifica o JWT
  do cookie **ou** do header `Authorization: Bearer`, confere a sessão em
  `sessoes` (mobile) e o usuário em `usuarios`.
- Multi-tenant: cada query filtra por `usuario_id`; acesso cruzado → 403.
  IDs são sequenciais — a proteção é o `usuario_id`, nunca "adivinhe o ID".

## Como rotacionar tokens

- **Web:** logout (`sair` no header) limpa o cookie. Para invalidar todas
  as sessões web, troque o `AUTH_SECRET` (derruba todo mundo de uma vez).
- **Mobile/desktop:** `DELETE /api/v1/auth/token` com o Bearer atual
  apaga a linha em `sessoes` (logout do dispositivo). Sessões expiradas
  (`expira_em` passado) são rejeitadas automaticamente.
- OAuth Google não guarda senha (`senha_hash` NULL); login Google nunca
  sobrescreve nome/senha de conta existente.

## LGPD (dados de cliente)

- Relatórios contêm dados do cliente do pentester (nomes, escopos, IPs em
  evidências). São dados **do usuário da plataforma**, isolados por
  `usuario_id` com `ON DELETE CASCADE`: apagar o usuário apaga tudo.
- Evidências vão para a IA (Gemini/Groq) na geração — informe isso no seu
  contrato com o cliente final; anonimize antes se necessário.
- Banco local (`pentest.db`, git-ignorado). Em deploy, o SQLite deve ser
  trocado por Postgres/Turso com disco criptografado e backup (ver
  `docs/PENDENCIAS.md` se existir).
- Logs `[IA]` registram URL/modelo/status — nunca chaves, senhas ou tokens.
- Sem cookies de terceiros, sem analytics. `robots.txt` bloqueia `/api/`.

## Checklist antes de expor na internet

- [ ] `AUTH_SECRET` forte e fora do repo
- [ ] `AUTH_URL` + `AUTH_TRUST_HOST` configurados no domínio final
- [ ] `GOOGLE_CLIENT_ID/SECRET` (se usar login Google)
- [ ] Security headers (`HSTS`, `X-Frame-Options`) no proxy/CDN
- [ ] Rate limiting no reverse proxy (a API não tem — ver pendências)
- [ ] Backup do banco + plano de restore

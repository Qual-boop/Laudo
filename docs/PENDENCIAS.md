# Pendências pós-varredura (out/2026)

Corrigidos na varredura completa (build + 165 testes verdes):

- [x] F6 `escapeHtml` corrompia apóstrofos (`exportacao.ts:30` — `"\u0027;"` gerava `';`)
- [x] F7 `window.open(..., "_blank")` sem `noopener` (`exportacao.ts:303,312`)
- [x] F15 hash com `localeCompare("pt-BR")` (`certificado.ts:94` — agora codepoint)
- [x] F16 `key={i}` no formulário de achados (`painel/page.tsx:553` — chave estável)
- [x] IDOR na página `/certificado/[id]` (agora checa dono; metadata não vaza)
- [x] Relatórios sem dono (`usuario_id NULL`) legíveis/exportáveis (agora 403)
- [x] Trial reutilizável via pagar→cancelar (nova coluna `trial_usado_em`)
- [x] `POST /gerar` sem cota (agora checa limite; consumo segue no salvar)
- [x] Checkout duplo (nova trava `ASSINATURA_ATIVA` p/ assinatura ativa)
- [x] Downgrade preguiçoso não limpava o banco (agora zera expira + marca `expirada`)
- [x] `iniciar-tudo.sh` com `else` órfão + `sleep` fixo (polling até 40s/30s)
- [x] E2E `--apenas=checkout` isolado quebrava (faltava cadastro do usuário-base)
- [x] Docs com Stripe (`AMBIENTE-DEV.md` citava `stripe-listen.service`; README sem billing)

Bugs F6–F20 do diagnóstico ainda deferidos (médios/baixos):

- [ ] F8 export via query-string estoura limite de URL em relatórios grandes
- [ ] F10 `aoSalvar` com closure stale (`PainelVerificacao.tsx:72`)
- [x] F11 security headers globais em `next.config.ts` (`lib/cabecalhos-seguranca.ts`):
      CSP, HSTS (2 anos, sem preload), `nosniff`, `X-Frame-Options: DENY` +
      `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`,
      `Permissions-Policy`; sem `X-Powered-By`. O `/c/` mantém `noindex` + `no-referrer`
- [ ] CSP ainda com `script-src 'unsafe-inline'`: com Cache Components o shell é
      estático, então não dá para usar nonce por request sem tornar tudo dinâmico.
      Saída futura: hashes/SRI quando o Next suportar para os scripts inline do RSC
- [ ] F13 `setTimeout` sem cleanup + `import().then()` sem `.catch`
- [ ] F14 `copiarParaClipboard` sem fallback http
- [ ] F17 flash do Onboarding + Tabs sem `aria-controls`/setas
- [ ] F18 header "online" estático
- [ ] F19 `salvar()` com `corpo=null` cai em mensagem imprecisa
- [ ] F9, F12, F20 — já resolvidos anteriormente ✅

Infra e produto (deferidos — exigem decisão/proxy, não bug de código):

- [x] Rate limiting em login/cadastro/token (`lib/limite-taxa.ts`, em memória):
      login web (`/api/auth/callback/credentials`) e `POST /api/v1/auth/token`
      dividem o contador — 30/15 min por IP e 10/15 min por e-mail (login certo
      zera o do e-mail); cadastro 20/h por IP e 5/h por e-mail. Estourou → 429
      com `Retry-After`. IP = entrada mais à direita do `X-Forwarded-For`
      (a do proxy; `PROXIES_CONFIAVEIS` ajusta se houver mais de um salto)
- [ ] Rate limit é por processo: com mais de uma réplica no Railway, mover o
      contador para o banco/Redis. Depois do deploy, conferir com XFF forjado
      que o 429 continua chegando (a doc do Railway não garante se o edge
      acrescenta ou sobrescreve o XFF; o código assume o valor da direita)
- [ ] Logout não revoga JWT copiado (exige denylist/versão de sessão — desenho pendente)
- [x] `CHECKOUT_PAID` + 1º `PAYMENT_RECEIVED` estendiam 2x (~60 dias por 1 mês pago) —
      agora a expiração é absoluta (`fimDoPeriodo`: vencimento da cobrança + 1 mês/ano
      de calendário, até 23:59 BRT), não cumulativa: CHECKOUT_PAID, `PAYMENT_CONFIRMED`
      e `PAYMENT_RECEIVED` da mesma cobrança cobrem o mesmo período, em qualquer ordem.
      `PAYMENT_CONFIRMED` passou a contar (cartão: RECEIVED só chega ~30 dias depois).
      Efeito colateral: pagar durante o trial não soma os dias restantes do trial
- [ ] `PAYMENT_OVERDUE` só marca `past_due` (sem carência/bloqueio — decisão de cobrança)
- [ ] Pagamento que chega depois de o plano expirar não devolve o Pro: o downgrade
      preguiçoso (`assinaturaDe`) zera `plano` e o webhook de pagamento só mexe na
      expiração. Precisa guardar o plano assinado (ex.: coluna `assinatura_plano`)
      e restaurá-lo no pagamento — ligado à decisão de carência do OVERDUE
- [ ] `POST /gerar` checa mas não incrementa; `DELETE /verificacao` não reembolsa cota
- [ ] Mês de cota em UTC (`mesAtual`), não BRT
- [x] Webhook sempre responde 200 (proposital p/ Asaas não reenviar) — agora cada chamada
      vira uma linha JSON no log (`{"webhook":"asaas","id","event","aplicado","motivo"}`,
      sem payload), inclusive `token inválido` e `json inválido`
- [x] `BCRYPT_ROUNDS` aceitava mínimo 4 — em produção (`NODE_ENV=production`) o piso é 10
- [ ] Plano da UI vem do JWT (stale até relogar; API já usa o fresco do banco)
- [ ] `resetarUsoMensal` sem chamada em produção (reset real é por `mes_ano`)
- [x] Export `texto` com relatório parcial (500 em produção — `gerarExportacaoTexto` blindado no deploy)
- [ ] Export Jira/GitHub ainda assume achado completo (`cvss.score` — `TypeError` com JSON parcial)
- [ ] `GOOGLE_CLIENT_ID/SECRET` (código pronto; botão aparece sozinho quando configurar)
- [ ] Decisão de produto: `/certificado/[id]` hoje exige login — para
      compartilhar com o cliente final, criar link público com token/hash
- [ ] Backup do banco + plano de restore
- [ ] Apps mobile (Expo) e desktop (Tauri) sobre `/api/v1/*` (roadmap)

## Deploy Railway (out/2026)

- [ ] Revogar no GitHub o PAT antigo (`ghp_...`) — o remote já está sem token (auth via `gh auth setup-git`)
- [x] `deploy.yml` (Vercel) virou `ci.yml`: só testes + build, com `next typegen` (o CI quebrava com `PageProps` ausente)
- [ ] Configurar Asaas no Railway (`ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`) — sem isso o checkout responde 502
- [x] SEO sem o placeholder `laudo.app`: metadataBase, sitemap e robots vêm de `NEXT_PUBLIC_APP_URL` (`src/lib/site.ts`) — domínio próprio = trocar só a variável
- [ ] Redirects de compat da API usam `Location` relativo (proxy do Railway entrega host interno); revisar se algum cliente depender de URL absoluta

## Landing 10/10 (out/2026)

- [x] E-mail de contato: eliasmecenasseabra@gmail.com (`EMAIL_CONTATO` em src/lib/site.ts; termos, privacidade e rodapé)
- [x] Plano Team: compartilhamento (Pro 1 colega, Team 10) e comentários de revisão por achado
- [x] Link público do certificado: `/c/<token>` (256 bits, coluna `relatorios.certificado_token`), sem login, só certificado 100% verificado de dono Pro/Team; "copiar link público" e "revogar link" na página do certificado; `/c/<token>/json` entrega o JSON canônico para recalcular o hash (`curl -s … | sha256sum`). No ar desde 17/10/2026 (deploy Railway)
- [x] Prints de evidência com tarja no navegador; quadro de conformidade (PCI/ISO/LGPD/BCB); agenda de retestes (.ics)
- [ ] Lembrete por e-mail (hoje: alarme do calendário via .ics) — exige provedor de e-mail
- [ ] Revisão jurídica do texto do quadro de conformidade (referências normativas)

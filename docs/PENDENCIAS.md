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

- [x] F8 export via query-string estoura limite de URL — `urlComLimite` corta só o corpo (≤ 7,5 KB), avisa e copia o texto completo
- [x] F10 `aoSalvar` com closure stale — lê a lista mais recente por ref
- [x] F11 security headers globais em `next.config.ts` (`lib/cabecalhos-seguranca.ts`):
      CSP, HSTS (2 anos, sem preload), `nosniff`, `X-Frame-Options: DENY` +
      `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`,
      `Permissions-Policy`; sem `X-Powered-By`. O `/c/` mantém `noindex` + `no-referrer`
- [ ] CSP ainda com `script-src 'unsafe-inline'`: com Cache Components o shell é
      estático, então não dá para usar nonce por request sem tornar tudo dinâmico.
      Saída futura: hashes/SRI quando o Next suportar para os scripts inline do RSC
- [x] F13 `setTimeout` sem cleanup + `import().then()` sem `.catch` (import estático; `window.open` sai direto do clique e não cai no bloqueador de pop-up)
- [x] F14 `copiarParaClipboard` com fallback `execCommand` (painel, exportação, certificado)
- [x] F17 flash do Onboarding + Tabs com `aria-controls`, tabpanel, tabindex roving e setas/Home/End
- [x] F18 header "online" reflete `navigator.onLine`
- [x] F19 `salvar()` com 2xx sem corpo avisa para conferir o Histórico (não "sem conexão")
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
- [x] Logout revoga a sessão no servidor: todo JWT (web e Bearer) carrega `sid` da tabela `sessoes`; "sair de todos os dispositivos" no perfil; troca de senha derruba todas
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
- [x] `POST /gerar` consome a cota de gerações com IA (2× a de relatórios) + rajada 20/10 min. `DELETE /verificacao` não reembolsa de propósito (reembolsar deixaria o Free reciclar retestes)
- [x] Mês de cota em BRT (`America/Sao_Paulo`)
- [x] Webhook sempre responde 200 (proposital p/ Asaas não reenviar) — agora cada chamada
      vira uma linha JSON no log (`{"webhook":"asaas","id","event","aplicado","motivo"}`,
      sem payload), inclusive `token inválido` e `json inválido`
- [x] `BCRYPT_ROUNDS` aceitava mínimo 4 — em produção (`NODE_ENV=production`) o piso é 10
- [x] Plano da UI fresco: o callback `jwt` relê nome e plano do banco a cada uso
- [ ] `resetarUsoMensal` sem chamada em produção (reset real é por `mes_ano`)
- [x] Export `texto` com relatório parcial (500 em produção — `gerarExportacaoTexto` blindado no deploy)
- [x] Export Jira/GitHub com relatório/achado parcial (CVSS "N/D", listas vazias)
- [ ] `GOOGLE_CLIENT_ID/SECRET` (código pronto; botão aparece sozinho quando configurar)
- [ ] Decisão de produto: `/certificado/[id]` hoje exige login — para
      compartilhar com o cliente final, criar link público com token/hash
- [ ] Backup do banco + plano de restore
- [ ] Apps mobile (Expo) e desktop (Tauri) sobre `/api/v1/*` (roadmap)

## Deploy Railway (out/2026)

- [ ] Revogar no GitHub o PAT antigo (`ghp_...`) — o remote já está sem token (auth via `gh auth setup-git`)
- [x] `deploy.yml` (Vercel) virou `ci.yml`: só testes + build, com `next typegen` (o CI quebrava com `PageProps` ausente)
- [ ] Configurar o Stripe no Railway (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) — sem isso o checkout responde 503 (ver `docs/STRIPE-SETUP.md`)
- [x] SEO sem o placeholder `laudo.app`: metadataBase, sitemap e robots vêm de `NEXT_PUBLIC_APP_URL` (`src/lib/site.ts`) — domínio próprio = trocar só a variável
- [ ] Redirects de compat da API usam `Location` relativo (proxy do Railway entrega host interno); revisar se algum cliente depender de URL absoluta

## Landing 10/10 (out/2026)

- [x] E-mail de contato: eliasmecenasseabra@gmail.com (`EMAIL_CONTATO` em src/lib/site.ts; termos, privacidade e rodapé)
- [x] Plano Team: compartilhamento (Pro 1 colega, Team 10) e comentários de revisão por achado
- [x] Link público do certificado: `/c/<token>` (256 bits, coluna `relatorios.certificado_token`), sem login, só certificado 100% verificado de dono Pro/Team; "copiar link público" e "revogar link" na página do certificado; `/c/<token>/json` entrega o JSON canônico para recalcular o hash (`curl -s … | sha256sum`). No ar desde 17/10/2026 (deploy Railway)
- [x] Prints de evidência com tarja no navegador; quadro de conformidade (PCI/ISO/LGPD/BCB); agenda de retestes (.ics)
- [ ] Lembrete por e-mail (hoje: alarme do calendário via .ics) — o envio já existe (lib/email.ts); falta o agendador
- [ ] Revisão jurídica do texto do quadro de conformidade (referências normativas)

## Segurança e limites (18/10/2026)

- [x] Pro 300 e Team 900 relatórios/mês; consumo atômico (sem estouro por requisições simultâneas)
- [x] Login em 2 etapas por e-mail (senha + código de 6 dígitos; HMAC no banco; 5 tentativas; 10 min) e "esqueci minha senha" — liga com BREVO_API_KEY/RESEND_API_KEY + EMAIL_REMETENTE; sem isso segue só com senha
- [x] CSRF explícito: mutação em /api/ só com Origin do próprio site (lib/origem.ts)
- [x] Senhas óbvias recusadas no cadastro e na troca; Cross-Origin-Opener-Policy: same-origin`n- [ ] Configurar o provedor de e-mail no Railway (decisão do dono: Brevo grátis com remetente verificado, ou Resend com domínio próprio)
- [ ] 2FA por app autenticador (TOTP) como alternativa ao e-mail

## Stripe, preços e documentos (20/10/2026)

- [x] Cobrança migrada do Asaas para o Stripe (checkout, webhook assinado, portal do cliente); trava de saques do Asaas removida
- [x] Pro R$ 22,90/mês (R$ 219,84/ano) e Team R$ 49,90/mês (R$ 479,04/ano) — fonte única em `PRECOS_CENTAVOS`
- [x] PDF profissional (/relatorio/[id]/pdf): capa, controle do documento, sumário com links, um achado por página, apêndices e "Página X de Y" (margin boxes do @page — Chrome/Edge 131+; no Firefox sai sem numeração)
- [x] Marca própria no PDF (tabela `marcas`) e resumo executivo de 1 página (Pro/Team)
- [x] Importação de Nuclei (JSON/JSONL) e OpenVAS/Greenbone (XML); exportação CSV com proteção contra CSV injection
- [ ] PDF gerado no servidor (download direto, sem a janela de impressão) — exige Chromium no Railway
- [ ] Permitir troca de plano pelo portal do Stripe (hoje os metadados do plano vêm do checkout)

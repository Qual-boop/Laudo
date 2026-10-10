# Pendências pós-MVP SaaS

 Bugs F6–F20 do diagnóstico (médios/baixos, deferidos pelo usuário):

- [ ] F6 `escapeHtml` corrompe apóstrofos (`exportacao.ts:30`)
- [ ] F7 `window.open(..., "_blank")` sem `noopener` (`exportacao.ts:284,293`)
- [ ] F8 export via query-string estoura limite de URL em relatórios grandes
- [ ] F9 `DELETE /api/verificacao` sem param → 404 em vez de 400 — **corrigido na v1** ✅
- [ ] F10 `aoSalvar` com closure stale (`PainelVerificacao.tsx:72`)
- [ ] F11 sem security headers (adicionar no proxy/CDN ou `next.config.ts`)
- [ ] F12 tabela legada + dados de teste — **resolvido (Fase 2)** ✅
- [ ] F13 `setTimeout` sem cleanup + `import().then()` sem `.catch`
- [ ] F14 `copiarParaClipboard` sem fallback http
- [ ] F15 hash com `localeCompare("pt-BR")` (trocar por sort por codepoint)
- [ ] F16 `key={i}` na lista de achados do formulário
- [ ] F17 flash do Onboarding + Tabs sem `aria-controls`/setas
- [ ] F18 header "online" estático
- [ ] F19 `salvar()` com `corpo=null` cai em mensagem imprecisa
- [ ] F20 SQLite síncrono no cwd (trocar por Postgres/Turso em produção)

 Infra e produto:

- [ ] Rate limiting (a API não tem; fazer no reverse proxy)
- [ ] `GOOGLE_CLIENT_ID/SECRET` (código pronto; botão aparece sozinho quando configurar)
- [ ] Decisão de produto: `/certificado/[id]` hoje exige login — para
      compartilhar com o cliente final, criar link público com token/hash
- [ ] Backup do banco + plano de restore
- [ ] Assinaturas Pro/Team + limites por plano (roadmap)
- [ ] Apps mobile (Expo) e desktop (Tauri) sobre `/api/v1/*` (roadmap)

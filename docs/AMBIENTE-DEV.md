# Ambiente de desenvolvimento — Laudo

## Instalação única (só uma vez)

Opção A — systemd (precisa de sudo):

```bash
npm run servicos:instalar
```

Instala `stripe-listen.service` (auto-start no boot), cria
`/etc/stripe-listen.env` (root:root, 600) com a chave lida do `.env`,
habilita e inicia o serviço.

Opção B — sem sudo (cron `@reboot`):

```bash
bash scripts/autostart-cron.sh
```

## Rotina diária

```bash
# Ligar a VM
npm run ambiente:iniciar   # dev + túnel (mostra o link público)
# ...trabalhar (link em /tmp/laudo-tunnel-url.txt)...
npm run ambiente:parar     # ao terminar
```

> O Asaas não precisa de infra local (checkout e webhook são HTTPS).
> Para simular um webhook: `bash scripts/simular-webhook-asaas.sh CHECKOUT_PAID <usuario_id> pro mensal`.

## Diagnóstico

```bash
npm run ambiente:status    # dev? túnel? link?
```

## O que é automático

- **stripe listen**: desde o boot (systemd, ou cron `@reboot` na opção B).
- **npm run dev + cloudflared**: só quando você chama `ambiente:iniciar`.
- O link do túnel muda a cada início — sempre copie o novo de
  `/tmp/laudo-tunnel-url.txt` (e atualize `AUTH_URL` se usar OAuth).

## E2E (15 fluxos)

```bash
npm run build              # o e2e sobe o build de produção local
npm run e2e                # todos os 15 fluxos (cadastro → públicas)
npm run e2e:checkout       # só o fluxo 8
npm run e2e:auth           # só login cookie (fluxo 2)
bash scripts/e2e-completo.sh --apenas=limites  # qualquer fluxo pelo nome
```

O script sobe `next start` na porta 3456 (sem chaves de IA → fallback
determinístico), usa emails únicos com timestamp e **apaga todos os
usuários de teste no final** (trap). Fluxos com dependência (reteste,
certificado) criam as próprias fixtures — `--apenas` funciona isolado.

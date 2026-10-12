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
npm run ambiente:parar     # para dev + túnel (stripe continua)
```

## Diagnóstico

```bash
npm run ambiente:status    # dev? stripe? túnel? link?
npm run servicos:logs      # logs do stripe (systemd)
npm run servicos:reiniciar # reinicia o stripe se travar
bash scripts/parar-webhook.sh  # para o listen manual (modo sem systemd)
```

## O que é automático

- **stripe listen**: desde o boot (systemd, ou cron `@reboot` na opção B).
- **npm run dev + cloudflared**: só quando você chama `ambiente:iniciar`.
- O link do túnel muda a cada início — sempre copie o novo de
  `/tmp/laudo-tunnel-url.txt` (e atualize `AUTH_URL` se usar OAuth).

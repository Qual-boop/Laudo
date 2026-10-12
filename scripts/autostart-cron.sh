#!/bin/sh
# Alternativa SEM sudo: auto-start do stripe listen via cron @reboot.
# Uso: bash scripts/autostart-cron.sh
# (Use quando scripts/instalar-servicos.sh não for possível.)
set -u

PROJETO="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$HOME/.local/bin:$PATH"

COMANDO="@reboot sleep 30 && $HOME/.local/bin/stripe listen --api-key \$(grep '^STRIPE_SECRET_KEY=' $PROJETO/.env | cut -d= -f2 | tr -d '\"' | tr -d '[:space:]') --forward-to localhost:3000/api/v1/webhook/stripe --skip-verify >> $HOME/.local/log-stripe-listen.log 2>&1"

mkdir -p "$HOME/.local"
ATUAL=$(crontab -l 2>/dev/null || true)
case "$ATUAL" in
  *"stripe listen"*"forward-to localhost:3000"*)
    echo "Já instalado no crontab. Nada a fazer."
    ;;
  *)
    (printf '%s\n' "$ATUAL" | grep -v '^$' ; printf '%s\n' "$COMANDO") | crontab -
    echo "Instalado no crontab do usuário:"
    crontab -l | grep "stripe listen"
    ;;
esac
echo "Log após reboot: $HOME/.local/log-stripe-listen.log"

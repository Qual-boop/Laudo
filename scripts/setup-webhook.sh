#!/bin/sh
# Sobe `stripe listen` em background e captura o whsec_ no .env.
# Uso: bash scripts/setup-webhook.sh   (ou npm run stripe:webhook:start)
# Parar: bash scripts/parar-webhook.sh (ou npm run stripe:webhook:stop)
set -u

export PATH="$HOME/.local/bin:$PATH"
LOG=/tmp/stripe-listen.log
PIDFILE=/tmp/stripe-listen.pid

KEY=$(grep '^STRIPE_SECRET_KEY=' .env 2>/dev/null | cut -d= -f2 | tr -d '"' | tr -d '[:space:]')
if [ -z "$KEY" ]; then
  echo "FALHA: STRIPE_SECRET_KEY ausente no .env" >&2
  exit 1
fi

# Evita duplicar: derruba listen anterior do mesmo destino.
# ([s] evita que o pkill mate o próprio shell — o padrão está na cmdline.)
pkill -f "[s]tripe listen.*forward-to localhost:3000/api/v1/webhook/stripe" 2>/dev/null
sleep 1

rm -f "$LOG" "$PIDFILE"
nohup stripe listen --api-key "$KEY" \
  --forward-to localhost:3000/api/v1/webhook/stripe \
  > "$LOG" 2>&1 &
echo $! > "$PIDFILE"
PID=$(cat "$PIDFILE")

sleep 5

if ! kill -0 "$PID" 2>/dev/null; then
  echo "FALHA: stripe listen morreu. Log:" >&2
  cat "$LOG" >&2
  exit 1
fi

WHSEC=$(grep -o 'whsec_[A-Za-z0-9]*' "$LOG" | head -n 1)
if [ -z "$WHSEC" ]; then
  echo "FALHA: whsec_ não apareceu em $LOG. Conteúdo:" >&2
  cat "$LOG" >&2
  exit 1
fi

if grep -q '^STRIPE_WEBHOOK_SECRET=' .env 2>/dev/null; then
  sed -i "s|^STRIPE_WEBHOOK_SECRET=.*|STRIPE_WEBHOOK_SECRET=$WHSEC|" .env
else
  printf '\nSTRIPE_WEBHOOK_SECRET=%s\n' "$WHSEC" >> .env
fi

echo "whsec capturado: $(printf '%s' "$WHSEC" | cut -c1-12)... (gravado no .env)"
echo "PID do stripe listen: $PID (pare com: kill $PID)"
grep -c "Ready!" "$LOG" >/dev/null 2>&1 && echo "Status: Ready!"

#!/bin/sh
# Para o `stripe listen` subido por scripts/setup-webhook.sh.
# Uso: bash scripts/parar-webhook.sh   (ou npm run stripe:webhook:stop)
PIDFILE=/tmp/stripe-listen.pid

if [ -f "$PIDFILE" ]; then
  PID=$(cat "$PIDFILE")
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" && echo "stripe listen (PID $PID) parado."
    rm -f "$PIDFILE"
    exit 0
  fi
  rm -f "$PIDFILE"
fi

# Fallback: procura qualquer listen do Laudo.
PIDS=$(pgrep -f "[s]tripe listen.*forward-to localhost:3000/api/v1/webhook/stripe" || true)
if [ -n "$PIDS" ]; then
  # shellcheck disable=SC2086
  kill $PIDS && echo "stripe listen parado (PIDs: $PIDS)."
else
  echo "Nenhum stripe listen rodando."
fi

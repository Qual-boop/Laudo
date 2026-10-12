#!/bin/sh
# Status do ambiente: dev, stripe listen, túnel + link atual.
# Uso: bash scripts/status-tudo.sh   (ou npm run ambiente:status)

echo "— dev server —"
if [ -f /tmp/laudo-dev.pid ] && kill -0 "$(cat /tmp/laudo-dev.pid)" 2>/dev/null; then
  if curl -s -o /dev/null -m 5 http://localhost:3000/; then
    echo "  ✅ rodando (PID $(cat /tmp/laudo-dev.pid), responde 3000)"
  else
    echo "  ⚠️  processo vivo (PID $(cat /tmp/laudo-dev.pid)) mas NÃO responde"
  fi
else
  echo "  ❌ parado"
fi

echo "— stripe listen —"
if systemctl is-active --quiet stripe-listen 2>/dev/null; then
  echo "  ✅ ativo (systemd)"
elif pgrep -f "[s]tripe listen.*forward-to localhost:3000" > /dev/null 2>&1; then
  echo "  ✅ ativo (processo, PID $(pgrep -f "[s]tripe listen.*forward-to localhost:3000" | head -n 1))"
else
  echo "  ❌ inativo"
fi

echo "— cloudflared —"
if [ -f /tmp/laudo-tunnel.pid ] && kill -0 "$(cat /tmp/laudo-tunnel.pid)" 2>/dev/null; then
  echo "  ✅ rodando (PID $(cat /tmp/laudo-tunnel.pid))"
else
  echo "  ❌ parado"
fi

echo "— link do túnel —"
if [ -f /tmp/laudo-tunnel-url.txt ]; then
  echo "  $(cat /tmp/laudo-tunnel-url.txt)"
else
  echo "  (nenhum)"
fi

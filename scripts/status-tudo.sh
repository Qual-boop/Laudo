#!/bin/sh
# Status do ambiente: dev, túnel + link atual.
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

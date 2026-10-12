#!/bin/sh
# Para dev server + túnel.
# Uso: bash scripts/parar-tudo.sh   (ou npm run ambiente:parar)
PARADOS=""

for F in /tmp/laudo-dev.pid /tmp/laudo-tunnel.pid; do
  NOME=$(basename "$F" .pid)
  if [ -f "$F" ]; then
    P=$(cat "$F" 2>/dev/null || true)
    if [ -n "$P" ] && kill -0 "$P" 2>/dev/null; then
      kill "$P" 2>/dev/null && PARADOS="$PARADOS $NOME($P)"
    else
      PARADOS="$PARADOS $NOME(já-morto)"
    fi
    rm -f "$F"
  else
    PARADOS="$PARADOS $NOME(sem-pid)"
  fi
done

echo "Parado:$PARADOS"

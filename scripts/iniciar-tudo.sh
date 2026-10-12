#!/bin/sh
# Sobe o ambiente completo: dev server + túnel cloudflared.
# Uso: bash scripts/iniciar-tudo.sh   (ou npm run ambiente:iniciar)
# O stripe listen roda à parte (systemd ou cron) — aqui só conferimos.
set -u

PROJETO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJETO" || exit 1

DEV_PID=/tmp/laudo-dev.pid
TUN_PID=/tmp/laudo-tunnel.pid
TUN_LOG=/tmp/laudo-tunnel.log
TUN_URL=/tmp/laudo-tunnel-url.txt

echo "— stripe listen —"
if systemctl is-active --quiet stripe-listen 2>/dev/null; then
  STRIPE_TXT="ativo (systemd)"
elif pgrep -f "[s]tripe listen.*forward-to localhost:3000" > /dev/null 2>&1; then
  STRIPE_TXT="ativo (processo)"
else
  STRIPE_TXT="INATIVO — rode npm run stripe:webhook:start ou instale o serviço"
fi
echo "  $STRIPE_TXT"

echo "— limpando processos antigos —"
for F in "$DEV_PID" "$TUN_PID"; do
  if [ -f "$F" ]; then
    P=$(cat "$F" 2>/dev/null || true)
    if [ -n "$P" ] && kill -0 "$P" 2>/dev/null; then kill "$P" 2>/dev/null || true; fi
    rm -f "$F"
  fi
done
sleep 1

echo "— subindo next dev (PID é o servidor, sem wrapper npm) —"
rm -f /tmp/laudo-dev.log
nohup npx next dev > /tmp/laudo-dev.log 2>&1 &
echo $! > "$DEV_PID"
sleep 5

DEV_OK=0
if curl -s -o /dev/null -m 10 http://localhost:3000/; then DEV_OK=1; fi
# PID real do servidor (npx cria shells intermediários que morrem):
# resolve pela porta em vez de confiar no $! do lançador.
DEV_PID_N=$(fuser 3000/tcp 2>/dev/null | sed 's/.*://' | awk '{print $1}')
if [ -z "$DEV_PID_N" ]; then DEV_PID_N=$(cat "$DEV_PID" 2>/dev/null || true); fi
echo "$DEV_PID_N" > "$DEV_PID"

echo "— subindo cloudflared —"
rm -f "$TUN_LOG" "$TUN_URL"
nohup cloudflared tunnel --url http://127.0.0.1:3000 > "$TUN_LOG" 2>&1 &
echo $! > "$TUN_PID"
sleep 10

LINK=$(grep -o 'https://[a-zA-Z0-9.-]*\.trycloudflare\.com' "$TUN_LOG" 2>/dev/null | head -n 1 || true)
if [ -n "$LINK" ]; then printf '%s\n' "$LINK" > "$TUN_URL"; fi
TUN_PID_N=$(cat "$TUN_PID")

{
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "  LAUDO — AMBIENTE INICIADO"
  echo "═══════════════════════════════════════════════════════════"
  echo ""
  if [ "$DEV_OK" = "1" ]; then
    echo "  Dev server:     ✅ rodando em http://localhost:3000 (PID $DEV_PID_N)"
  else
    echo "  Dev server:     ❌ NÃO responde (PID $DEV_PID_N — ver /tmp/laudo-dev.log)"
  fi
  echo "  Stripe listen:  $STRIPE_TXT"
  if [ -n "$LINK" ] && kill -0 "$TUN_PID_N" 2>/dev/null; then
    echo "  Cloudflared:    ✅ rodando (PID $TUN_PID_N)"
    echo ""
    echo "  🌐 Link público:"
    echo "     $LINK"
  else
    echo "  Cloudflared:    ❌ sem link (PID $TUN_PID_N — ver $TUN_LOG)"
  fi
  echo ""
  echo "  Comandos úteis:"
  echo "     npm run ambiente:status   → ver status"
  echo "     npm run ambiente:parar    → parar tudo"
  echo "     npm run servicos:logs     → ver logs do stripe"
  echo "═══════════════════════════════════════════════════════════"
}

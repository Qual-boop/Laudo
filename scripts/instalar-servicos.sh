#!/bin/sh
# Instala o systemd service do stripe listen (auto-start no boot).
# Uso: bash scripts/instalar-servicos.sh   (ou npm run servicos:instalar)
# Precisa de sudo (systemd + /etc/). Sem sudo? Use scripts/autostart-cron.sh.
set -u

PROJETO="$(cd "$(dirname "$0")/.." && pwd)"
UNIT_ORIGEM="$PROJETO/scripts/systemd/stripe-listen.service"
UNIT_DESTINO=/etc/systemd/system/stripe-listen.service
ENV_ARQUIVO=/etc/stripe-listen.env

if [ ! -f "$PROJETO/.env" ]; then
  echo "FALHA: $PROJETO/.env não encontrado" >&2
  exit 1
fi
KEY=$(grep '^STRIPE_SECRET_KEY=' "$PROJETO/.env" | cut -d= -f2 | tr -d '"' | tr -d '[:space:]')
if [ -z "$KEY" ]; then
  echo "FALHA: STRIPE_SECRET_KEY ausente no .env" >&2
  exit 1
fi

echo "1/6 Gravando $ENV_ARQUIVO ..."
printf 'STRIPE_SECRET_KEY=%s\n' "$KEY" | sudo tee "$ENV_ARQUIVO" > /dev/null
sudo chown root:root "$ENV_ARQUIVO"
sudo chmod 600 "$ENV_ARQUIVO"
ls -l "$ENV_ARQUIVO"

echo "2/6 Instalando unit ..."
sudo cp "$UNIT_ORIGEM" "$UNIT_DESTINO"

echo "3/6 daemon-reload ..."
sudo systemctl daemon-reload

echo "4/6 enable ..."
sudo systemctl enable stripe-listen

echo "5/6 start ..."
sudo systemctl restart stripe-listen
sleep 3

echo "6/6 status ..."
sudo systemctl status stripe-listen --no-pager --lines=8 || true

echo "--- log (20 linhas) ---"
sudo tail -n 20 /var/log/stripe-listen.log || echo "(log ainda vazio)"

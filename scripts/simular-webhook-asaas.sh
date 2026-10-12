#!/bin/sh
# Simula um webhook do Asaas contra o servidor local (sem precisar do painel).
# Uso: bash scripts/simular-webhook-asaas.sh <evento> <usuario_id> [plano] [periodo]
#   eventos: CHECKOUT_PAID | SUBSCRIPTION_CREATED | PAYMENT_RECEIVED |
#            PAYMENT_OVERDUE | SUBSCRIPTION_DELETED
# Exemplos:
#   bash scripts/simular-webhook-asaas.sh CHECKOUT_PAID 1 pro mensal
#   bash scripts/simular-webhook-asaas.sh PAYMENT_RECEIVED 1
# Requer o dev server rodando (http://localhost:3000).
set -u

EVENTO="${1:-}"
USUARIO="${2:-}"
PLANO="${3:-pro}"
PERIODO="${4:-mensal}"

if [ -z "$EVENTO" ] || [ -z "$USUARIO" ]; then
  echo "Uso: $0 <evento> <usuario_id> [plano] [periodo]" >&2
  exit 1
fi

ID="evt_sim_$(date +%s)"
case "$EVENTO" in
  CHECKOUT_PAID)
    EXTRA="\"checkout\":{\"id\":\"ck_sim_1\",\"customer\":\"cus_sim_1\",\"externalReference\":\"$USUARIO:$PLANO:$PERIODO\"}" ;;
  SUBSCRIPTION_CREATED)
    EXTRA="\"subscription\":{\"id\":\"sub_sim_1\",\"customer\":\"cus_sim_1\",\"cycle\":\"MONTHLY\"}" ;;
  PAYMENT_RECEIVED)
    EXTRA="\"payment\":{\"id\":\"pay_sim_1\",\"subscription\":\"sub_sim_1\"}" ;;
  PAYMENT_OVERDUE)
    EXTRA="\"payment\":{\"id\":\"pay_sim_1\",\"subscription\":\"sub_sim_1\"}" ;;
  SUBSCRIPTION_DELETED)
    EXTRA="\"subscription\":{\"id\":\"sub_sim_1\"}" ;;
  *)
    echo "Evento desconhecido: $EVENTO" >&2
    exit 1
    ;;
esac

TOKEN=$(grep '^ASAAS_WEBHOOK_TOKEN=' .env 2>/dev/null | cut -d= -f2 | tr -d '"' | tr -d '[:space:]')
HEADER=""
if [ -n "$TOKEN" ]; then
  HEADER="-H asaas-access-token:$TOKEN"
fi

# shellcheck disable=SC2086
curl -s -w "\nHTTP:%{http_code}\n" -X POST http://localhost:3000/api/v1/webhook/asaas \
  -H 'Content-Type: application/json' $HEADER \
  -d "{\"id\":\"$ID\",\"event\":\"$EVENTO\",$EXTRA}"

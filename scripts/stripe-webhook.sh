#!/bin/sh
# Encaminha webhooks do Stripe (modo teste) para o Laudo local.
# NÃO rode automaticamente — é interativo e fica escutando.
# Uso: sh scripts/stripe-webhook.sh
# O primeiro login (`stripe login`) abre o browser uma única vez.
export PATH="$HOME/.local/bin:$PATH"
exec stripe listen --forward-to localhost:3000/api/v1/webhook/stripe

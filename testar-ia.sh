#!/usr/bin/env bash
set -euo pipefail

# Carrega OPENAI_API_KEY e OPENAI_BASE_URL do .env
set -a
source "$(dirname "$0")/.env"
set +a

BASE_URL="${OPENAI_BASE_URL:-https://api.groq.com/openai/v1}"
MODELO="llama-3.1-8b-instant"

echo "=== Teste direto na API de IA ==="
echo "URL:    ${BASE_URL}/chat/completions"
echo "Modelo: ${MODELO}"
echo "Chave:  ${OPENAI_API_KEY:0:9}...${OPENAI_API_KEY: -4}"
echo ""

curl -sS -w "\n\nHTTP_STATUS: %{http_code}\n" \
  -X POST "${BASE_URL}/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${OPENAI_API_KEY}" \
  -d '{
    "model": "llama-3.1-8b-instant",
    "messages": [
      {"role": "user", "content": "Responda em json com as chaves \"status\" e \"mensagem\"."}
    ],
    "response_format": {"type": "json_object"},
    "max_tokens": 2000,
    "temperature": 0.3
  }'

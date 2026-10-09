#!/usr/bin/env bash
# Teste direto da API do Gemini via camada de compatibilidade OpenAI.
# Não faz parte do app — script descartável de diagnóstico.
set -euo pipefail

# Carrega as variáveis do .env sem exportar o resto do ambiente do shell.
set -a
source "$(dirname "$0")/.env"
set +a

BASE_URL="${OPENAI_BASE_URL:-https://generativelanguage.googleapis.com/v1beta/openai/}"
MODELO="${LAUDO_MODELO:-gemini-3.8-flash}"

echo "=== Teste direto na API do Gemini ==="
echo "Host:   $(echo "$BASE_URL" | sed -E 's#(https://[^/]+).*#\1#')"
echo "URL:    ${BASE_URL}chat/completions"
echo "Modelo: $MODELO"
echo "Chave:  ${OPENAI_API_KEY:0:8}...${OPENAI_API_KEY: -4}  (${#OPENAI_API_KEY} chars)"
echo ""

curl -sS -w "\n\nHTTP_STATUS: %{http_code}\n" \
  -X POST "${BASE_URL}chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${OPENAI_API_KEY}" \
  -d "{
    \"model\": \"${MODELO}\",
    \"messages\": [
      {\"role\": \"user\", \"content\": \"Responda APENAS com um JSON válido, sem texto adicional, sem cercas de código: {\\\"status\\\": \\\"ok\\\", \\\"modelo\\\": \\\"gemini\\\"}\"}
    ],
    \"response_format\": {\"type\": \"json_object\"},
    \"max_tokens\": 100
  }"

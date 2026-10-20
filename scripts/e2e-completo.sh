#!/bin/sh
# E2E completo do Laudo: 15 fluxos contra build de produção local.
# Uso: bash scripts/e2e-completo.sh [--apenas=<fluxo>]
#   fluxos: cadastro auth listar-relatorios gerar salvar verificacao reteste
#           checkout limites exportacao certificado isolamento planos logout publicas
# Requisitos: `npm run build` já executado; sqlite3 instalado.
# Sobe `next start` próprio na porta 3456 (sem chaves de IA → fallback
# determinístico) e limpa todos os usuários de teste no final (trap).
set -u

PORTA=3456
BASE="http://localhost:$PORTA"
TS=$(date +%s)
PASS=0
FAIL=0
RESULTADOS=""

APENAS=""
for A in "$@"; do
  case "$A" in
    --apenas=*) APENAS="${A#--apenas=}" ;;
  esac
done

deve_rodar() {
  [ -z "$APENAS" ] && return 0
  [ "$APENAS" = "$1" ] && return 0
  return 1
}

registrar() {
  # $1 nome, $2 ok(1/0), $3 ms
  if [ "$2" = "1" ]; then
    PASS=$((PASS + 1)); STATUS="✅"
  else
    FAIL=$((FAIL + 1)); STATUS="❌"
  fi
  RESULTADOS="$RESULTADOS\n| $1 | $STATUS | $3 ms |"
  printf '%s %s (%s ms)\n' "$STATUS" "$1" "$3"
}

agora_ms() { date +%s%3N; }

json() { python3 -c "import sys,json;print(json.load(sys.stdin)$1)" 2>/dev/null; }

limpar() {
  sqlite3 pentest.db "PRAGMA foreign_keys=ON; DELETE FROM usuarios WHERE email LIKE 'e2e+%@laudo-teste.com';" 2>/dev/null || true
  if [ -n "${SERVIDOR_PID:-}" ] && kill -0 "$SERVIDOR_PID" 2>/dev/null; then
    kill "$SERVIDOR_PID" 2>/dev/null || true
  fi
}
trap limpar EXIT

# ---------- boot ----------
if [ ! -d .next ]; then
  echo "FALHA: sem build. Rode 'npm run build' antes." >&2
  exit 1
fi
if ! command -v sqlite3 > /dev/null 2>&1; then
  echo "FALHA: sqlite3 não instalado." >&2
  exit 1
fi

OPENAI_API_KEY= GROQ_API_KEY= nohup npx next start -p "$PORTA" > /tmp/laudo-e2e.log 2>&1 &
SERVIDOR_PID=$!
for _ in $(seq 1 30); do
  if curl -s -o /dev/null -m 3 "$BASE/"; then break; fi
  sleep 1
done
curl -s -o /dev/null -m 5 "$BASE/" || { echo "FALHA: servidor não subiu (ver /tmp/laudo-e2e.log)" >&2; exit 1; }
echo "Servidor E2E no ar em $BASE (PID $SERVIDOR_PID)"
echo ""

EMAIL1="e2e+$TS.u1@laudo-teste.com"
EMAIL2="e2e+$TS.u2@laudo-teste.com"
SENHA="senha-123456"

# ---------- fixtures (cada fluxo funciona até com --apenas isolado) ----------
garantir_relatorio_json() {
  if [ ! -s /tmp/e2e-rel.json ]; then
    curl -s -X POST "$BASE/api/v1/gerar" -H "Authorization: Bearer $TOKEN1" -H 'Content-Type: application/json' -d '{"cliente":"Acme E2E","achados":[{"titulo":"SQLi E2E","severidade":"Alta"}]}' > /tmp/e2e-rel.json
  fi
}

garantir_relatorio() {
  garantir_relatorio_json
  local rid
  rid=$(curl -s -H "Authorization: Bearer $TOKEN1" "$BASE/api/v1/relatorios?limit=1" | json "[0]['id']")
  if [ -z "$rid" ]; then
    rid=$(curl -s -X POST "$BASE/api/v1/relatorios" -H "Authorization: Bearer $TOKEN1" -H 'Content-Type: application/json' -d @/tmp/e2e-rel.json | json "['id']")
  fi
  printf '%s' "$rid"
}

garantir_achado() {
  garantir_relatorio > /dev/null
  curl -s -H "Authorization: Bearer $TOKEN1" "$BASE/api/v1/verificacao?limit=1" | json "[0]['id']"
}

# ---------- FLUXO 1 — cadastro ----------
if deve_rodar cadastro; then
  INI=$(agora_ms)
  R1=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v1/auth/cadastro" -H 'Content-Type: application/json' -d "{\"nome\":\"E2E Um\",\"email\":\"$EMAIL1\",\"senha\":\"$SENHA\"}")
  OK=0; [ "$(printf '%s' "$R1" | tail -n 1)" = "201" ] && OK=1
  RDUP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/auth/cadastro" -H 'Content-Type: application/json' -d "{\"nome\":\"X\",\"email\":\"$EMAIL1\",\"senha\":\"$SENHA\"}")
  [ "$RDUP" = "409" ] || OK=0
  RCURTA=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/auth/cadastro" -H 'Content-Type: application/json' -d "{\"nome\":\"X\",\"email\":\"e2e+$TS.x@laudo-teste.com\",\"senha\":\"curta\"}")
  [ "$RCURTA" = "400" ] || OK=0
  RMAIL=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/auth/cadastro" -H 'Content-Type: application/json' -d '{"nome":"X","email":"nao-email","senha":"senha-123456"}')
  [ "$RMAIL" = "400" ] || OK=0
  registrar "1. Cadastro" "$OK" $(( $(agora_ms) - INI ))
fi

# ---------- token helper ----------
# Modo isolado (--apenas=X): o fluxo 1 (cadastro) é pulado, então garante
# aqui o usuário-base. No run completo APENAS="" e o fluxo 1 cria (201).
if [ -n "$APENAS" ]; then
  curl -s -X POST "$BASE/api/v1/auth/cadastro" -H 'Content-Type: application/json' -d "{\"nome\":\"E2E Um\",\"email\":\"$EMAIL1\",\"senha\":\"$SENHA\"}" > /dev/null
fi
TOKEN1=$(curl -s -X POST "$BASE/api/v1/auth/token" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL1\",\"senha\":\"$SENHA\"}" | json "['token']")
if [ -z "$TOKEN1" ]; then echo "FALHA: sem token para $EMAIL1" >&2; exit 1; fi
curl -s -X POST "$BASE/api/v1/auth/cadastro" -H 'Content-Type: application/json' -d "{\"nome\":\"E2E Dois\",\"email\":\"$EMAIL2\",\"senha\":\"$SENHA\"}" > /dev/null
TOKEN2=$(curl -s -X POST "$BASE/api/v1/auth/token" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL2\",\"senha\":\"$SENHA\"}" | json "['token']")

# ---------- FLUXO 2 — login cookie ----------
if deve_rodar auth; then
  INI=$(agora_ms); OK=1
  JAR1=$(mktemp); JAR2=$(mktemp)
  CSRF=$(curl -s -c "$JAR1" "$BASE/api/auth/csrf" | json "['csrfToken']")
  LOGIN=$(curl -s -b "$JAR1" -c "$JAR2" -X POST "$BASE/api/auth/callback/credentials" -H 'Content-Type: application/x-www-form-urlencoded' -H 'X-Auth-Return-Redirect: 1' --data-urlencode "csrfToken=$CSRF" --data-urlencode "email=$EMAIL1" --data-urlencode "senha=$SENHA" --data-urlencode "callbackUrl=$BASE/")
  echo "$LOGIN" | grep -q '"url"' || OK=0
  echo "$LOGIN" | grep -q 'error' && OK=0
  grep -q "authjs.session-token" "$JAR2" || OK=0
  # senha errada e email inexistente → url com error= (NextAuth codifica falha na URL, status 200)
  CSRF2=$(curl -s -c "$JAR1" "$BASE/api/auth/csrf" | json "['csrfToken']")
  ERRO1=$(curl -s -b "$JAR1" -X POST "$BASE/api/auth/callback/credentials" -H 'Content-Type: application/x-www-form-urlencoded' -H 'X-Auth-Return-Redirect: 1' --data-urlencode "csrfToken=$CSRF2" --data-urlencode "email=$EMAIL1" --data-urlencode "senha=errada-12345" --data-urlencode "callbackUrl=$BASE/")
  echo "$ERRO1" | grep -q 'error=' || OK=0
  ERRO2=$(curl -s -b "$JAR1" -X POST "$BASE/api/auth/callback/credentials" -H 'Content-Type: application/x-www-form-urlencoded' -H 'X-Auth-Return-Redirect: 1' --data-urlencode "csrfToken=$CSRF2" --data-urlencode "email=ninguem@laudo-teste.com" --data-urlencode "senha=$SENHA" --data-urlencode "callbackUrl=$BASE/")
  echo "$ERRO2" | grep -q 'error=' || OK=0
  rm -f "$JAR1" "$JAR2"
  registrar "2. Login" "$OK" $(( $(agora_ms) - INI ))
fi

# ---------- FLUXO 3 — listar ----------
if deve_rodar listar-relatorios; then
  INI=$(agora_ms); OK=1
  L=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN1" "$BASE/api/v1/relatorios")
  [ "$(printf '%s' "$L" | tail -n 1)" = "200" ] || OK=0
  printf '%s' "$L" | head -n 1 | python3 -c "import sys,json;assert isinstance(json.load(sys.stdin), list)" 2>/dev/null || OK=0
  S=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/v1/relatorios")
  [ "$S" = "401" ] || OK=0
  registrar "3. Listar relatórios" "$OK" $(( $(agora_ms) - INI ))
fi

# ---------- FLUXO 4 — gerar ----------
if deve_rodar gerar; then
  INI=$(agora_ms); OK=1
  G=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v1/gerar" -H "Authorization: Bearer $TOKEN1" -H 'Content-Type: application/json' -d '{"cliente":"Acme E2E","achados":[{"titulo":"SQLi E2E","severidade":"Alta"}]}')
  [ "$(printf '%s' "$G" | tail -n 1)" = "200" ] || OK=0
  printf '%s' "$G" | head -n 1 > /tmp/e2e-rel.json
  python3 -c "
import json
r = json.load(open('/tmp/e2e-rel.json'))
assert r['capa'] and r['sumarioExecutivo'] and r['escopoMetodologia'] and isinstance(r['achados'], list) and len(r['achados']) >= 1 and isinstance(r['recomendacoesGerais'], list) and r['conclusao']
" 2>/dev/null || OK=0
  GI=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/gerar" -H "Authorization: Bearer $TOKEN1" -H 'Content-Type: application/json' -d '{"cliente":"C","achados":[]}')
  [ "$GI" = "400" ] || OK=0
  registrar "4. Gerar relatório" "$OK" $(( $(agora_ms) - INI ))
fi

# ---------- FLUXO 5 — salvar ----------
if deve_rodar salvar; then
  INI=$(agora_ms); OK=1
  garantir_relatorio_json
  SV=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v1/relatorios" -H "Authorization: Bearer $TOKEN1" -H 'Content-Type: application/json' -d @/tmp/e2e-rel.json)
  [ "$(printf '%s' "$SV" | tail -n 1)" = "201" ] || OK=0
  REL_ID=$(printf '%s' "$SV" | head -n 1 | json "['id']")
  [ -n "$REL_ID" ] || OK=0
  SA=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/relatorios" -H 'Content-Type: application/json' -d @/tmp/e2e-rel.json)
  [ "$SA" = "401" ] || OK=0
  SB=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/relatorios" -H "Authorization: Bearer $TOKEN1" -H 'Content-Type: application/json' -d '{"capa":{}}')
  [ "$SB" = "400" ] || OK=0
  registrar "5. Salvar relatório" "$OK" $(( $(agora_ms) - INI ))
fi

# ---------- FLUXO 6 — verificação lista ----------
if deve_rodar verificacao; then
  INI=$(agora_ms); OK=1
  V=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN1" "$BASE/api/v1/verificacao")
  [ "$(printf '%s' "$V" | tail -n 1)" = "200" ] || OK=0
  VA=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/v1/verificacao")
  [ "$VA" = "401" ] || OK=0
  registrar "6. Verificação (lista)" "$OK" $(( $(agora_ms) - INI ))
fi

# ---------- FLUXO 7 — reteste ----------
if deve_rodar reteste; then
  INI=$(agora_ms); OK=1
  AID=$(garantir_achado)
  R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v1/verificacao" -H "Authorization: Bearer $TOKEN1" -H 'Content-Type: application/json' -d "{\"achadoId\":$AID,\"resultado\":\"corrigido\",\"evidencia\":\"e2e-ok\"}")
  [ "$(printf '%s' "$R" | tail -n 1)" = "201" ] || OK=0
  RSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/verificacao" -H "Authorization: Bearer $TOKEN1" -H 'Content-Type: application/json' -d "{\"achadoId\":$AID,\"resultado\":\"corrigido\",\"evidencia\":\"  \"}")
  [ "$RSE" = "400" ] || OK=0
  RSA=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/verificacao" -H 'Content-Type: application/json' -d "{\"achadoId\":$AID,\"resultado\":\"corrigido\",\"evidencia\":\"x\"}")
  [ "$RSA" = "401" ] || OK=0
  registrar "7. Registrar reteste" "$OK" $(( $(agora_ms) - INI ))
fi

# ---------- FLUXO 8 — checkout (Stripe) ----------
# Sem STRIPE_SECRET_KEY: espera 503 PAGAMENTO_INDISPONIVEL (degradação limpa).
# Com chave: 200 + link do checkout hospedado do Stripe.
if deve_rodar checkout; then
  INI=$(agora_ms); OK=1
  C=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v1/checkout" -H "Authorization: Bearer $TOKEN1" -H 'Content-Type: application/json' -d '{"plano":"pro","ciclo":"mensal"}')
  if grep -q '^STRIPE_SECRET_KEY=.\+' .env 2>/dev/null; then
    [ "$(printf '%s' "$C" | tail -n 1)" = "200" ] || OK=0
    printf '%s' "$C" | head -n 1 | grep -q "checkout.stripe.com" || OK=0
  else
    [ "$(printf '%s' "$C" | tail -n 1)" = "503" ] || OK=0
    printf '%s' "$C" | head -n 1 | grep -q "PAGAMENTO_INDISPONIVEL" || OK=0
  fi
  CA=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/checkout" -H 'Content-Type: application/json' -d '{"plano":"pro","periodo":"mensal"}')
  [ "$CA" = "401" ] || OK=0
  CI=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/checkout" -H "Authorization: Bearer $TOKEN1" -H 'Content-Type: application/json' -d '{"plano":"diamante","periodo":"mensal"}')
  [ "$CI" = "400" ] || OK=0
  registrar "8. Checkout" "$OK" $(( $(agora_ms) - INI ))
fi

# ---------- FLUXO 8b — webhook Stripe (idempotência, hermético) ----------
# Em dev sem STRIPE_WEBHOOK_SECRET a rota aceita sem assinatura.
# Evento desconhecido com id único: registra e ignora (sem efeito no plano).
# Repetir o mesmo id → "já processado". Limpa a linha de teste no final.
if deve_rodar checkout; then
  INI=$(agora_ms); OK=1
  EVID="evt_e2e_${TS}"
  W1=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v1/webhook/stripe" -H 'Content-Type: application/json' -d "{\"id\":\"$EVID\",\"type\":\"e2e.ignorado\",\"data\":{\"object\":{\"id\":\"x\"}}}")
  [ "$(printf '%s' "$W1" | tail -n 1)" = "200" ] || OK=0
  printf '%s' "$W1" | head -n 1 | grep -q '"ok":true' || OK=0
  W2=$(curl -s -X POST "$BASE/api/v1/webhook/stripe" -H 'Content-Type: application/json' -d "{\"id\":\"$EVID\",\"type\":\"e2e.ignorado\",\"data\":{\"object\":{\"id\":\"x\"}}}")
  echo "$W2" | grep -q '"ok":true' || OK=0
  N=$(sqlite3 pentest.db "SELECT COUNT(*) FROM webhook_eventos WHERE id='$EVID';")
  [ "$N" = "1" ] || OK=0
  sqlite3 pentest.db "DELETE FROM webhook_eventos WHERE id='$EVID';"
  registrar "8b. Webhook (idempotente)" "$OK" $(( $(agora_ms) - INI ))
fi

# ---------- FLUXO 9 — limites ----------
if deve_rodar limites; then
  INI=$(agora_ms); OK=1
  EMAIL9="e2e+$TS.lim@laudo-teste.com"
  curl -s -X POST "$BASE/api/v1/auth/cadastro" -H 'Content-Type: application/json' -d "{\"nome\":\"Lim\",\"email\":\"$EMAIL9\",\"senha\":\"$SENHA\"}" > /dev/null
  T9=$(curl -s -X POST "$BASE/api/v1/auth/token" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL9\",\"senha\":\"$SENHA\"}" | json "['token']")
  garantir_relatorio_json
  for _ in 1 2 3; do
    S=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/relatorios" -H "Authorization: Bearer $T9" -H 'Content-Type: application/json' -d @/tmp/e2e-rel.json)
    [ "$S" = "201" ] || OK=0
  done
  S4=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v1/relatorios" -H "Authorization: Bearer $T9" -H 'Content-Type: application/json' -d @/tmp/e2e-rel.json)
  [ "$(printf '%s' "$S4" | tail -n 1)" = "402" ] || OK=0
  printf '%s' "$S4" | head -n 1 | grep -q "LIMITE_PLANO" || OK=0
  # reset via banco → libera de novo
  UID9=$(sqlite3 pentest.db "SELECT id FROM usuarios WHERE email='$EMAIL9';")
  sqlite3 pentest.db "DELETE FROM uso_mensal WHERE usuario_id=$UID9;"
  S5=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/relatorios" -H "Authorization: Bearer $T9" -H 'Content-Type: application/json' -d @/tmp/e2e-rel.json)
  [ "$S5" = "201" ] || OK=0
  registrar "9. Limites do Free" "$OK" $(( $(agora_ms) - INI ))
fi

# ---------- FLUXO 10 — exportação ----------
if deve_rodar exportacao; then
  INI=$(agora_ms); OK=1
  RID=$(garantir_relatorio)
  M=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN1" "$BASE/api/v1/relatorios/$RID/export?formato=texto")
  [ "$(printf '%s' "$M" | tail -n 1)" = "200" ] || OK=0
  printf '%s' "$M" | grep -qi "laudo" || OK=0
  MI=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN1" "$BASE/api/v1/relatorios/$RID/export?formato=xml")
  [ "$MI" = "400" ] || OK=0
  # free não exporta jira (402), mas texto passa
  MJ=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN1" "$BASE/api/v1/relatorios/$RID/export?formato=markdown")
  [ "$MJ" = "402" ] || OK=0
  registrar "10. Exportação" "$OK" $(( $(agora_ms) - INI ))
fi

# ---------- FLUXO 11 — certificado ----------
if deve_rodar certificado; then
  INI=$(agora_ms); OK=1
  # garante 1 achado verificado (independe do fluxo 7)
  AID11=$(garantir_achado)
  curl -s -X POST "$BASE/api/v1/verificacao" -H "Authorization: Bearer $TOKEN1" -H 'Content-Type: application/json' -d "{\"achadoId\":$AID11,\"resultado\":\"corrigido\",\"evidencia\":\"e2e-cert\"}" > /dev/null
  # user1 tem 1 achado verificado (fluxo 7) → 200 + hash
  RID=$(garantir_relatorio)
  C=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN1" "$BASE/api/v1/certificado/$RID")
  # user1 é free → 402 (gating); então usa upgrade simulado via banco
  UID1=$(sqlite3 pentest.db "SELECT id FROM usuarios WHERE email='$EMAIL1';")
  sqlite3 pentest.db "UPDATE usuarios SET plano='pro' WHERE id=$UID1;"
  T1P=$(curl -s -X POST "$BASE/api/v1/auth/token" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL1\",\"senha\":\"$SENHA\"}" | json "['token']")
  C2=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $T1P" "$BASE/api/v1/certificado/$RID")
  [ "$(printf '%s' "$C2" | tail -n 1)" = "200" ] || OK=0
  printf '%s' "$C2" | head -n 1 | grep -q '"hash"' || OK=0
  # relatório novo com achado pendente → 404 pendente
  curl -s -X POST "$BASE/api/v1/relatorios" -H "Authorization: Bearer $T1P" -H 'Content-Type: application/json' -d @/tmp/e2e-rel.json > /dev/null
  RID2=$(curl -s -H "Authorization: Bearer $T1P" "$BASE/api/v1/relatorios?limit=1" | json "[0]['id']")
  CP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $T1P" "$BASE/api/v1/certificado/$RID2")
  [ "$(printf '%s' "$CP" | tail -n 1)" = "404" ] || OK=0
  printf '%s' "$CP" | head -n 1 | grep -q "CERTIFICADO_PENDENTE" || OK=0
  sqlite3 pentest.db "UPDATE usuarios SET plano='free' WHERE id=$UID1;"
  registrar "11. Certificado" "$OK" $(( $(agora_ms) - INI ))
fi

# ---------- FLUXO 12 — isolamento ----------
if deve_rodar isolamento; then
  INI=$(agora_ms); OK=1
  RID=$(garantir_relatorio)
  A=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN2" "$BASE/api/v1/relatorios/$RID")
  [ "$A" = "403" ] || OK=0
  L2=$(curl -s -H "Authorization: Bearer $TOKEN2" "$BASE/api/v1/relatorios" | python3 -c "import sys,json;print(len(json.load(sys.stdin)))")
  [ "$L2" = "0" ] || OK=0
  registrar "12. Isolamento multi-usuário" "$OK" $(( $(agora_ms) - INI ))
fi

# ---------- FLUXO 13 — planos ----------
if deve_rodar planos; then
  INI=$(agora_ms); OK=1
  U=$(curl -s -H "Authorization: Bearer $TOKEN2" "$BASE/api/v1/uso")
  echo "$U" | grep -q '"plano":"free"' || OK=0
  UID2=$(sqlite3 pentest.db "SELECT id FROM usuarios WHERE email='$EMAIL2';")
  sqlite3 pentest.db "UPDATE usuarios SET plano='pro' WHERE id=$UID2;"
  T2P=$(curl -s -X POST "$BASE/api/v1/auth/token" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL2\",\"senha\":\"$SENHA\"}" | json "['token']")
  for _ in $(seq 1 10); do
    S=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/relatorios" -H "Authorization: Bearer $T2P" -H 'Content-Type: application/json' -d @/tmp/e2e-rel.json)
    [ "$S" = "201" ] || OK=0
  done
  UP=$(curl -s -H "Authorization: Bearer $T2P" "$BASE/api/v1/uso")
  echo "$UP" | grep -q '"plano":"pro"' || OK=0
  sqlite3 pentest.db "UPDATE usuarios SET plano='free' WHERE id=$UID2;"
  registrar "13. Planos" "$OK" $(( $(agora_ms) - INI ))
fi

# ---------- FLUXO 14 — logout ----------
# O signout do NextAuth v5 não expira o cookie JWT; o Laudo expõe
# POST /api/v1/auth/logout que expira de verdade. Testa ele.
if deve_rodar logout; then
  INI=$(agora_ms); OK=1
  JAR=$(mktemp)
  CSRF=$(curl -s -c "$JAR" "$BASE/api/auth/csrf" | json "['csrfToken']")
  curl -s -b "$JAR" -c "$JAR" -X POST "$BASE/api/auth/callback/credentials" -H 'Content-Type: application/x-www-form-urlencoded' -H 'X-Auth-Return-Redirect: 1' --data-urlencode "csrfToken=$CSRF" --data-urlencode "email=$EMAIL1" --data-urlencode "senha=$SENHA" --data-urlencode "callbackUrl=$BASE/" > /dev/null
  grep -q "authjs.session-token" "$JAR" || OK=0
  SO=$(curl -s -i -b "$JAR" -X POST "$BASE/api/v1/auth/logout")
  echo "$SO" | grep -q '"ok":true' || OK=0
  echo "$SO" | grep -qi "set-cookie.*authjs.session-token=;" || OK=0
  echo "$SO" | grep -qi "1970" || OK=0
  # sem cookie → 401
  SA=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/v1/relatorios")
  [ "$SA" = "401" ] || OK=0
  rm -f "$JAR"
  registrar "14. Logout" "$OK" $(( $(agora_ms) - INI ))
fi

# ---------- FLUXO 15 — rotas públicas ----------
if deve_rodar publicas; then
  INI=$(agora_ms); OK=1
  for P in "/" "/login" "/cadastro" "/precos"; do
    S=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$P")
    [ "$S" = "200" ] || OK=0
  done
  R=$(curl -s -o /dev/null -w "%{http_code} %{redirect_url}" "$BASE/painel")
  echo "$R" | grep -q "307" || OK=0
  echo "$R" | grep -q "/login" || OK=0
  SA=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/v1/relatorios")
  [ "$SA" = "401" ] || OK=0
  registrar "15. Rotas públicas" "$OK" $(( $(agora_ms) - INI ))
fi

# ---------- tabela ----------
printf '\n| Fluxo | Status | Tempo |\n|-------|--------|-------|\n'
printf '%b\n' "$RESULTADOS" | grep -v '^$'
printf '\nTotal: %s passou, %s falhou\n' "$PASS" "$FAIL"
[ "$FAIL" = "0" ]

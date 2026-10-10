# Protocolo de Trabalho Resiliente OpenCode

## Regra das 3 Fases
- Nunca peça mais de 3 fases em uma única mensagem
- Always commite após cada fase
- Se travar, o git preserva o progresso

## Protocolo de Recuperação
1. Se o OpenCode travar: `git log --oneline` → identificar última fase commitada
2. Reabrir OpenCode e pedir para continuar a partir da primeira não commitada
3. Se build falhar: `git checkout .` → refazer a fase

## Sinais de Alerta
- Mais de 10 min sem output → provável timeout
- Tela congelada → Ctrl+C e reiniciar
- Erro 504 repetido → trocar de modelo para big-pickle

## Checklist Antes de Sair
- `git commit -m "wip"`
- `xset s off && xset -dpms`
- PC na tomada (não suspender)
- Confirmar build bem-sucedido

## Missões Concluídas
1. ✅ Timeouts + retry (20min, auto-retry em 408/429/502/503/504)
2. ✅ Modelo estável (big-pickle substituindo nemotron-3-ultra-free)
3. ✅ Context pruning (plugins instalados + snapshot: false)
4. ✅ Workflow resiliente (documentado em OPENCODE-WORKFLOW.md)
# Guia do Usuário — Laudo

## Visão geral

O **Laudo** é um gerador de relatórios de teste de intrusão. Você preenche um formulário
com os dados do engagement, descreve os achados e a IA gera um relatório profissional
com capa, sumário executivo, matriz de risco, timeline, achados detalhados e certificado
de correção.

## Primeiro acesso — tour de onboarding

Ao visitar pela primeira vez, um modal aparece com 4 passos:

1. **Preencher engagement** — Preencha cliente, título, escopo, período e ferramentas.
2. **Adicionar achados** — Descreva cada achado com título, severidade, CWE, confiança,
   descrição e evidência.
3. **Gerar relatório** — Clique em "Gerar relatório" e aguarde a IA processar.
4. **Exportar e compartilhar** — Use os botões de exportar PDF, Jira ou GitHub.

A flag `onboarding_shown` é salva no `localStorage` e o tour não reaparece em visitas
subsequentes.

## Criar um engagement

1. Acesse `http://localhost:3000`
2. Preencha os dados do engagement no formulário inicial:
   - **Cliente**: nome da empresa ou organização (ex: "Acme Corp")
   - **Título do relatório**: título formal (ex: "Relatório de Teste de Intrusão")
   - **Escopo**: o que foi testado (ex: "aplicação web https://app.acme.com e API https://api.acme.com/v2")
   - **Período do teste**: intervalo de datas (ex: "01/10/2026 a 09/10/2026")
   - **Ferramentas**: ferramentas usadas, separadas por vírgula (ex: "Burp Suite, Nmap, SQLmap")
3. Clique fora ou o foco será movido automaticamente para a seção de achados.

## Adicionar achados

1. Na seção "Achados", clique em "+ adicionar achado" para adicionar um novo campo.
2. Para cada achado, preencha:
   - **Título**: descrição curta do problema (ex: "SQL Injection no formulário de login")
   - **Severidade**: Critica, Alta, Media ou Baixa
   - **CWE**: código CWE (ex: "CWE-89")
   - **Confiança**: quão certo você está (Alta, Media ou Baixa)
   - **Reteste sugerido**: data sugerida para reteste (formato date, opcional)
   - **Descrição**: contexto, causa raiz e o que o atacante consegue fazer
   - **Evidência**: requisição, resposta, payload — entra no relatório como está
3. Pode duplicar ou remover achados usando os botões no final de cada linha.
4. Campos obrigatórios: título de pelo menos um achado deve estar preenchido para gerar.

## Gerar o relatório

1. Depois de adicionar os achados, clique no botão "Gerar relatório".
2. A IA processará os dados e gerará o relatório completo (isso pode levar alguns segundos).
3. Se todos os provedores de IA falharem, um relatório local será gerado como fallback.
4. O relatório será exibido na tela com preview e opções de exportação.

## Exportar e compartilhar

### Exportar PDF

- Clique no botão "Exportar PDF" ou use `window.print()`.
- O PDF é gerado no cliente (browser) usando a exibição na tela.
- As informações de severidade são preservadas via bordas grosseiras em B&W.

### Exportar para Jira

- Preencha a URL base do Jira nas configurações de exportação.
- Clique em "Exportar para Jira".
- O relatório será criado como um ticket no Jira com os detalhes dos achados.

### Exportar para GitHub

- Preencha a URL do repositório GitHub nas configurações de exportação.
- Clique em "Exportar para GitHub".
- Um issue será criado com os detalhes do relatório.

## Retestar

1. Acesse a aba "Verificação" para ver a lista de relatórios salvos.
2. Selecione um relatório para reabrir o formulário preenchido.
3. Ajuste os achados conforme necessário e gere um novo relatório.
4. A cada geração, os CVSS e recomendações são recalculados baseados nos dados atuais.

## Emitir certificado

1. Após o relatório ser gerado, navegue até a aba "Certificado".
2. O certificado de correção será exibido com as informações do cliente e do relatório.
3. Use o botão de download para salvar o certificado em PDF.
4. O certificado comprova que as vulnerabilidades foram identificadas e documentadas.

## Atalhos e dicas

- Use `Ctrl+K` ou `Cmd+K` para foco rápido nos campos
- Os botões têm `aria-label` para leitores de tela
- Foco visível está ativo em todos os elementos interativos (borda verde)
- O modo de impressão otimiza o layout para A4 com quebras de página adequadas
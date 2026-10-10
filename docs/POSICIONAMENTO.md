# Posicionamento — Laudo

## Por que não somos mais um gerador de PDF

O Laudo deixou de ser apenas um gerador de PDF estático para se tornar uma plataforma
completa de relatórios de pentest com IA. A evolução responde a três necessidades:

1. **PDFs manuais são demorados** — Gerar um relatório profissional do zero leva horas.
   O Laudo reduz isso a segundos, usando IA para transformar achados em documentos
   estruturados.

2. **Falta de automação no follow-up** — Relatórios PDF não se integram a ferramentas de
   rastreio. O Laudo permite exportar para Jira e GitHub, criar certificados de
   correção e gerenciar retestes — tudo em um fluxo conectado.

3. **Atualização contínua** — Com o PDF, cada mudança nos achados requer reimpressão.
   O Laudo usa um banco de dados (SQLite) que persiste os relatórios, permitindo
   retestes, versões e histórico.

## Comparação com outras ferramentas

| Ferramenta | Tipo | Principais diferenças |
| --- | --- | --- |
| **PlexTrac** | Plataforma GRC completa | PlexTrac é um produto enterprise focado em governança, risco e conformidade.
   O Laudo é leve, de código aberto e foca exclusivamente na geração de relatórios
   de teste de intrusão com IA. |
| **AttackForge** | Ferramenta de teste de intrusão | AttackForge foca na execução e automação de testes. O Laudo foca no
   *pós-teste* — transformar achados em relatórios profissionais com IA. |
| **SysReptor** | Gerador de relatórios de segurança | SysReptor gera relatórios automatizados a partir de resultados de scanner.
   O Laudo aceita entrada humana livreia e enriquece com IA (CVSS, OWASP, recomendações,
   passos de reprodução). |

## Filosofia

- **IA como assistente, não substituição** — A IA gera rascunhos e cálculos (CVSS, OWASP),
  mas o humano revisa, valida e decide o que é entregue ao cliente.
- **Dados persistem** — Diferente de geradores online de PDF, seus dados ficam no seu
  banco local (SQLite). Você controla tudo.
- **Foco no teste de intrusão** — Cada feature foi pensada para o fluxo de um pentest:
  do engagement ao relatório final, passando por certificados e retestes.

## Roadmap futuro

- Integração com mais provedores de IA
- Colaboração em tempo real
- Modelos de certificado personalizáveis
- API pública para integração com ferramentas externas
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { Icone, type NomeIcone } from "@/components/landing/Icone";
import { DemoReteste } from "@/components/landing/DemoReteste";
import { CicloAssurance } from "@/components/landing/CicloAssurance";
import { CertificadoExemplo } from "@/components/landing/CertificadoExemplo";
import {
  VinhetaCadastro,
  VinhetaDelta,
  VinhetaRelatorio,
  VinhetaReteste,
} from "@/components/landing/Vinhetas";
import { LIMITES } from "@/lib/planos";
import { EMAIL_CONTATO, REPOSITORIO, URL_SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "Provafix — Relatório de pentest, reteste e certificado de correção" },
  description:
    "Gere o relatório de pentest com IA, registre o reteste com evidência e entregue ao cliente um certificado de correção com hash SHA-256. Em português, grátis para começar.",
  alternates: { canonical: "/" },
};

/* ------------------------------------------------------------------ *
 * Conteúdo. Tudo aqui precisa ser verdade no produto — se uma linha
 * deixar de ser, mude a linha (não o produto às pressas).
 * ------------------------------------------------------------------ */

const ESPECIFICACOES = [
  "CVSS v3.1",
  "OWASP Top 10",
  "CWE",
  "Nessus · Burp · ZAP · SARIF",
  "SHA-256",
  "PDF A4",
  "Jira",
  "GitHub",
  "Código aberto · MIT",
];

const PASSOS: { titulo: string; texto: string; vinheta: () => ReactNode }[] = [
  {
    titulo: "Cadastre o engagement e os achados",
    texto:
      "Cliente, escopo, período, ferramentas e limitações. Cada achado entra com severidade, CWE, evidência e o quanto você confia nele.",
    vinheta: VinhetaCadastro,
  },
  {
    titulo: "Gere o relatório completo com IA",
    texto:
      "Sete seções prontas para revisar: sumário executivo, escopo, achados com CVSS e OWASP, recomendações de curto e longo prazo, conclusão e disclaimer.",
    vinheta: VinhetaRelatorio,
  },
  {
    titulo: "Registre o reteste com evidência",
    texto:
      "Para cada achado: data, resultado (corrigido, não corrigido ou parcial) e a evidência que comprova. Nada se perde — o histórico fica.",
    vinheta: VinhetaReteste,
  },
  {
    titulo: "Entregue o delta e o certificado",
    texto:
      "O relatório de delta mostra o antes e o depois. Com 100% dos achados verificados, o certificado de correção é liberado.",
    vinheta: VinhetaDelta,
  },
];

const PROVAS_CERTIFICADO: { titulo: string; texto: string; icone: NomeIcone }[] = [
  {
    titulo: "Só existe com 100% verificado",
    texto:
      "Enquanto houver achado pendente ou não corrigido, o Provafix mostra o que falta — e não emite o selo.",
    icone: "check",
  },
  {
    titulo: "Hash SHA-256 recalculável",
    texto:
      "O hash cobre relatório, achados, datas de reteste e emissão, em JSON canônico. Qualquer alteração muda o valor — e qualquer um pode recalcular.",
    icone: "hash",
  },
  {
    titulo: "Pronto para a reunião de acompanhamento",
    texto:
      "Imprime em A4 com fundo claro, junto do relatório de delta. É o documento que o seu cliente leva para a diretoria.",
    icone: "documento",
  },
];

const RECURSOS: { titulo: string; texto: string; icone: NomeIcone }[] = [
  {
    titulo: "Relatório de 7 seções",
    texto: "Capa, sumário executivo, escopo, achados, recomendações, conclusão e disclaimer.",
    icone: "documento",
  },
  {
    titulo: "CVSS, OWASP e CWE",
    texto: "Vetor CVSS v3.1, categoria OWASP, passos de reprodução e remediação por achado.",
    icone: "alvo",
  },
  {
    titulo: "Motor de verificação",
    texto: "Status por achado, prazo de correção por severidade e alerta de atraso antes da reunião.",
    icone: "radar",
  },
  {
    titulo: "Relatório de delta",
    texto: "O que mudou entre o achado original e o reteste, com a evidência de cada lado.",
    icone: "delta",
  },
  {
    titulo: "PDF, Jira e GitHub",
    texto: "PDF A4 com capa isolada e exportação de cada achado como ticket.",
    icone: "exportar",
  },
  {
    titulo: "IA que não te deixa na mão",
    texto: "Gemini, depois Groq, depois um relatório local. Você sempre sai com o documento.",
    icone: "camadas",
  },
  {
    titulo: "Escudo de privacidade",
    texto: "IPs, domínios, e-mails, CPF/CNPJ, senhas, tokens e o nome do cliente viram marcadores antes da IA — e voltam só no seu relatório.",
    icone: "cadeado",
  },
  {
    titulo: "Importação de scanners e SAST",
    texto: "Nessus, Burp Suite, OWASP ZAP e SARIF (Semgrep, CodeQL, Trivy, Snyk). O mesmo problema em 30 alvos vira um achado só.",
    icone: "exportar",
  },
  {
    titulo: "Kit de correção para devs",
    texto: "Por achado e na stack do cliente: código antes × depois, teste automatizado e o curl de reteste. Pronto para colar na issue ou no PR.",
    icone: "codigo",
  },
  {
    titulo: "CVSS calculado, não chutado",
    texto: "A IA escreve o vetor; a nota sai da fórmula oficial do CVSS 3.1. Nota e vetor nunca se contradizem.",
    icone: "hash",
  },
  {
    titulo: "Métricas de remediação",
    texto: "Taxa de correção, tempo médio até o reteste comprovar e o que está atrasado — os números da reunião de acompanhamento.",
    icone: "radar",
  },
  {
    titulo: "Quadro de conformidade",
    texto: "As evidências do pentest e do reteste organizadas por requisito: PCI DSS 11.4, ISO 27001 A.8.8, LGPD art. 46 e Banco Central.",
    icone: "documento",
  },
  {
    titulo: "Prints com tarja",
    texto: "Cubra tokens, CPFs e e-mails no próprio navegador antes de enviar. O original não sai da sua máquina.",
    icone: "cadeado",
  },
  {
    titulo: "Equipe e revisão",
    texto: "Compartilhe o relatório com colegas e revise por achado, com comentários. Revisão em dupla no Pro, até 10 no Team.",
    icone: "equipe",
  },
  {
    titulo: "Agenda de retestes",
    texto: "Retestes e vencimentos de prazo direto no Google Agenda, Outlook ou Apple, com lembrete na véspera.",
    icone: "check",
  },
  {
    titulo: "Biblioteca em português",
    texto: "Modelos dos achados mais comuns, de SQL Injection a JWT sem assinatura, com CWE e severidade típica.",
    icone: "documento",
  },
];

const PUBLICO: { titulo: string; texto: string; ganho: string; icone: NomeIcone }[] = [
  {
    titulo: "Pentesters freelancers",
    texto: "Entregue como uma consultoria grande, sem montar relatório no Word nem controlar reteste em planilha.",
    ganho: "O certificado vira argumento de venda — e de renovação.",
    icone: "usuario",
  },
  {
    titulo: "Consultorias pequenas",
    texto: "Um padrão de entrega para todo o time, do achado ao certificado.",
    ganho: "Cada projeto termina com prova, não com promessa.",
    icone: "equipe",
  },
  {
    titulo: "Times internos de segurança",
    texto: "Achado rastreável exportado para o Jira ou GitHub do time de desenvolvimento.",
    ganho: "O reteste fecha o ticket — com evidência.",
    icone: "codigo",
  },
];

type Celula = true | false | string;

const COMPARACAO: { recurso: string; laudo: Celula; pdf: Celula; enterprise: Celula }[] = [
  { recurso: "Relatório com IA (CVSS, OWASP, CWE)", laudo: true, pdf: false, enterprise: true },
  { recurso: "Reteste com evidência e histórico", laudo: true, pdf: false, enterprise: true },
  { recurso: "Certificado de correção com hash verificável", laudo: true, pdf: false, enterprise: "Varia" },
  { recurso: "Exportação por achado para Jira e GitHub", laudo: true, pdf: false, enterprise: true },
  { recurso: "Em português", laudo: true, pdf: "Varia", enterprise: "Raro" },
  { recurso: "Código aberto", laudo: "MIT", pdf: "Varia", enterprise: false },
  { recurso: "Preço", laudo: "A partir de R$ 0", pdf: "Baixo", enterprise: "Sob consulta" },
];

const FREE = LIMITES.free;

const PLANOS = [
  {
    nome: "Free",
    preco: "R$ 0",
    periodo: "para sempre",
    descricao: "Para conhecer o fluxo com projetos reais.",
    itens: [
      `${FREE.relatoriosMes} relatórios por mês`,
      `${FREE.achadosPorRelatorio} achados por relatório`,
      `${FREE.retestesMes} retestes por mês`,
      "Exportação em texto",
      `Histórico de ${FREE.historicoDias} dias`,
      "Prints de evidência com tarja",
    ],
    cta: "Começar grátis",
    href: "/cadastro",
    destaque: false,
  },
  {
    nome: "Pro",
    preco: "R$ 19,90",
    periodo: "/mês",
    descricao: "Para quem entrega pentest todo mês.",
    itens: [
      "Relatórios, achados e retestes ilimitados",
      "Certificado de correção com hash",
      "Quadro de conformidade e agenda de retestes",
      "Revisão em dupla com 1 colega",
      "Exportação para Jira e GitHub",
      "Sem marca d'água",
      "Histórico ilimitado",
    ],
    cta: "Assinar o Pro",
    href: "/cadastro?plano=pro",
    destaque: true,
  },
];

const FAQ: { pergunta: string; resposta: string }[] = [
  {
    pergunta: "O que exatamente o certificado prova?",
    resposta:
      "Que todos os achados do relatório foram retestados e marcados como corrigidos, com data de reteste. O hash SHA-256 é calculado sobre esses dados em JSON canônico: se alguém alterar um achado, uma data ou o cliente, o hash muda. Ele não substitui o seu parecer técnico — ele registra, de forma conferível, o que foi verificado.",
  },
  {
    pergunta: "A IA escreve o relatório por mim?",
    resposta:
      "Ela escreve o rascunho: sumário executivo, CVSS, categoria OWASP, passos de reprodução e recomendações. Você revisa, ajusta e decide o que vai para o cliente. Se o provedor de IA estiver fora do ar, o Provafix tenta o próximo e, em último caso, gera um relatório local.",
  },
  {
    pergunta: "Os dados dos meus clientes vão para a IA?",
    resposta:
      "Os dados identificáveis, não. Antes de cada geração, o Escudo de privacidade troca IPs, domínios, e-mails, CPF/CNPJ, cartões, senhas, tokens, cookies e o nome do cliente por marcadores como [[IP-1]]; a IA (Google Gemini; Groq como reserva, possivelmente fora do Brasil) recebe só o texto técnico mascarado, e os valores reais voltam apenas no seu relatório. Nomes internos que não seguem esses padrões — um sistema chamado \"Financeiro-SAP\", por exemplo — não são reconhecidos: revise o texto antes de gerar.",
  },
  {
    pergunta: "Em quais planos está o certificado?",
    resposta:
      "No Pro e no Team. No Free você usa relatório, verificação e reteste para conhecer o fluxo; a página do certificado mostra o que falta para liberá-lo.",
  },
  {
    pergunta: "Preciso de cartão para começar?",
    resposta:
      "Não. O Free não pede cartão. Nos planos pagos, o cancelamento vale ao fim do ciclo e a conta volta para o Free com os dados intactos.",
  },
  {
    pergunta: "O código é aberto mesmo?",
    resposta:
      "Sim, sob licença MIT, no GitHub. Você pode auditar como o hash do certificado é calculado — o que, para um produto de segurança, deveria ser o mínimo.",
  },
];

/* ------------------------------------------------------------------ *
 * Peças de layout
 * ------------------------------------------------------------------ */

function Cabecalho({
  sobretitulo,
  titulo,
  texto,
  centro,
}: {
  sobretitulo: string;
  titulo: ReactNode;
  texto?: ReactNode;
  centro?: boolean;
}) {
  return (
    <div className={`lp-revelar ${centro ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}`}>
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">{sobretitulo}</p>
      <h2 className="mt-4 text-balance text-[2rem] font-semibold leading-[1.1] tracking-[-0.025em] text-texto sm:text-[2.75rem]">
        {titulo}
      </h2>
      {texto && <p className="mt-5 text-lg leading-relaxed text-texto-2">{texto}</p>}
    </div>
  );
}

function Destaque({ children }: { children: ReactNode }) {
  return <em className="font-serif font-normal italic text-accent">{children}</em>;
}

function ValorCelula({ valor, laudo }: { valor: Celula; laudo?: boolean }) {
  if (valor === true) {
    return (
      <span className={laudo ? "text-accent" : "text-texto"}>
        <Icone nome="check" className="mx-auto h-5 w-5" />
        <span className="sr-only">Sim</span>
      </span>
    );
  }
  if (valor === false) {
    return (
      <span className="text-texto-2/40">
        —<span className="sr-only">Não</span>
      </span>
    );
  }
  return <span className={`text-sm ${laudo ? "font-medium text-accent" : "text-texto-2"}`}>{valor}</span>;
}

const CONTAINER = "mx-auto w-full max-w-6xl px-4 sm:px-6";

/* Dados estruturados (rich results): produto + perguntas frequentes. */
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${URL_SITE}/#organizacao`,
      name: "Provafix",
      url: URL_SITE,
      logo: `${URL_SITE}/icon.svg`,
      email: EMAIL_CONTATO,
      sameAs: [REPOSITORIO],
    },
    {
      "@type": "WebSite",
      "@id": `${URL_SITE}/#site`,
      name: "Provafix",
      url: URL_SITE,
      inLanguage: "pt-BR",
      publisher: { "@id": `${URL_SITE}/#organizacao` },
    },
    {
      "@type": "SoftwareApplication",
      name: "Provafix",
      publisher: { "@id": `${URL_SITE}/#organizacao` },
      url: URL_SITE,
      applicationCategory: "SecurityApplication",
      operatingSystem: "Web",
      inLanguage: "pt-BR",
      description:
        "Plataforma de assurance para pentest: relatório com IA, reteste com evidência e certificado de correção com hash SHA-256.",
      offers: [
        { "@type": "Offer", name: "Free", price: "0", priceCurrency: "BRL" },
        { "@type": "Offer", name: "Pro", price: "19.90", priceCurrency: "BRL" },
        { "@type": "Offer", name: "Team", price: "49.90", priceCurrency: "BRL" },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({
        "@type": "Question",
        name: f.pergunta,
        acceptedAnswer: { "@type": "Answer", text: f.resposta },
      })),
    },
  ],
};

export default function Landing() {
  return (
    <div className="lp-raiz flex flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }}
      />

      {/* ---------------------------------------------------- Cabeçalho */}
      <header className="no-print sticky top-0 z-20 border-b border-white/[0.06] bg-fundo/75 backdrop-blur-xl">
        <div className={`${CONTAINER} flex h-16 items-center gap-2 sm:gap-3`}>
          <a href="/" className="flex items-center gap-2.5" aria-label="Provafix — início">
            <Logo className="h-8 w-8 shrink-0 text-accent" />
            <span className="text-lg font-semibold tracking-tight text-texto">Provafix</span>
          </a>
          <nav aria-label="Seções" className="ml-8 hidden items-center gap-7 text-sm text-texto-2 lg:flex">
            <a href="#como-funciona" className="transition-colors hover:text-texto">Como funciona</a>
            <a href="#certificado" className="transition-colors hover:text-texto">Certificado</a>
            <a href="#precos" className="transition-colors hover:text-texto">Preços</a>
            <a href="#faq" className="transition-colors hover:text-texto">Dúvidas</a>
          </nav>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <a href="/login" className="rounded-full px-1.5 py-2 text-sm text-texto-2 transition-colors hover:text-texto sm:px-3">
              Entrar
            </a>
            <a href="/cadastro" className="lp-btn-primario lp-btn-pequeno">
              <span className="sm:hidden">Começar</span>
              <span className="hidden sm:inline">Começar grátis</span>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* -------------------------------------------------------- Hero */}
        <section className="relative overflow-hidden">
          <div className={`${CONTAINER} grid grid-cols-1 items-center gap-14 pb-20 pt-16 sm:pt-24 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-28 lg:pt-28`}>
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-texto-2">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Provafix · assurance para pentest · beta aberto
              </p>
              <h1 className="mt-7 text-[2.9rem] font-semibold leading-[1.02] tracking-[-0.035em] text-texto sm:text-[4rem] lg:text-[4.4rem]">
                Prove que as correções <Destaque>funcionaram.</Destaque>
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-texto-2 sm:text-xl">
                O Provafix leva o pentest até o fim: relatório com IA, reteste com
                evidência e um <span className="text-texto">certificado de correção</span>{" "}
                com hash verificável.
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <a href="/cadastro" className="lp-btn-primario">
                  Começar grátis
                  <Icone nome="seta" className="h-4 w-4" />
                </a>
                <a href="#certificado" className="lp-btn-secundario">
                  Ver um certificado
                </a>
              </div>
              <p className="mt-6 text-sm text-texto-2">
                Grátis para começar · sem cartão · em português
              </p>
            </div>

            <DemoReteste />
          </div>
        </section>

        {/* ------------------------------------------- Faixa de padrões */}
        <div className="border-y border-white/[0.06] bg-white/[0.015]">
          <ul
            aria-label="Padrões e integrações"
            className={`${CONTAINER} flex flex-wrap items-center justify-center gap-x-8 gap-y-3 py-6 font-mono text-xs uppercase tracking-[0.14em] text-texto-2`}
          >
            {ESPECIFICACOES.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>

        {/* ----------------------------------------------------- O ciclo */}
        <section id="ciclo" className="scroll-mt-20 py-24 sm:py-32">
          <div className={CONTAINER}>
            <Cabecalho
              sobretitulo="o problema"
              titulo={
                <>
                  O pentest costuma acabar no PDF. <Destaque>O&nbsp;risco, não.</Destaque>
                </>
              }
              texto="Você entrega o relatório, o cliente paga e o time de dev diz que corrigiu. Sem reteste com evidência, isso é uma afirmação — e no próximo ano a pergunta volta: quais continuam abertas?"
            />
            <div className="lp-revelar mt-16">
              <CicloAssurance />
            </div>
          </div>
        </section>

        {/* ----------------------------------------------- Como funciona */}
        <section id="como-funciona" className="scroll-mt-20 border-t border-white/[0.06] py-24 sm:py-32">
          <div className={CONTAINER}>
            <Cabecalho
              sobretitulo="como funciona"
              titulo={
                <>
                  Do achado ao certificado, <Destaque>num fluxo só.</Destaque>
                </>
              }
              texto="Quatro passos, a mesma ferramenta, nenhuma planilha de follow-up."
            />
            <ol className="mt-16 flex flex-col gap-16 sm:gap-20">
              {PASSOS.map((p, i) => {
                const Vinheta = p.vinheta;
                return (
                  <li
                    key={p.titulo}
                    className="lp-revelar grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-16"
                  >
                    <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                      <span className="font-mono text-sm text-accent">0{i + 1}</span>
                      <h3 className="mt-3 text-2xl font-semibold tracking-tight text-texto sm:text-[1.75rem]">
                        {p.titulo}
                      </h3>
                      <p className="mt-4 max-w-md text-base leading-relaxed text-texto-2">{p.texto}</p>
                    </div>
                    <div className={i % 2 === 1 ? "lg:order-1" : ""}>
                      <Vinheta />
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------- Certificado */}
        <section id="certificado" className="relative scroll-mt-20 overflow-hidden border-t border-white/[0.06] py-24 sm:py-32">
          <div aria-hidden="true" className="lp-aura absolute left-1/2 top-1/3 -z-0 h-[36rem] w-[60rem] -translate-x-1/2 opacity-60" />
          <div className={`${CONTAINER} relative`}>
            <Cabecalho
              centro
              sobretitulo="o entregável"
              titulo={
                <>
                  Seu cliente não compra um relatório. <Destaque>Compra a certeza.</Destaque>
                </>
              }
              texto="O certificado de correção é o documento que fecha o ciclo: o que foi encontrado, quando foi retestado e a prova de que foi corrigido."
            />
            <div className="lp-revelar mx-auto mt-14 max-w-4xl">
              <CertificadoExemplo />
              <p className="mt-4 text-center text-xs text-texto-2">
                Dados fictícios. O hash, não: é o SHA-256 real do conteúdo acima.
              </p>
            </div>
            <ul className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-10 md:grid-cols-3">
              {PROVAS_CERTIFICADO.map((p) => (
                <li key={p.titulo}>
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-accent">
                    <Icone nome={p.icone} />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-texto">{p.titulo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-texto-2">{p.texto}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------------------------------------------------- Recursos */}
        <section id="recursos" className="scroll-mt-20 border-t border-white/[0.06] py-24 sm:py-32">
          <div className={CONTAINER}>
            <Cabecalho
              sobretitulo="o que está incluso"
              titulo="Tudo o que um engagement precisa, do scan ao certificado."
            />
            <ul className="mt-14 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
              {RECURSOS.map((r) => (
                <li key={r.titulo} className="lp-revelar border-t border-white/[0.08] pt-6">
                  <Icone nome={r.icone} className="h-6 w-6 text-accent" />
                  <h3 className="mt-4 text-base font-semibold text-texto">{r.titulo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-texto-2">{r.texto}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------- Para quem é */}
        <section id="para-quem" className="scroll-mt-20 border-t border-white/[0.06] py-24 sm:py-32">
          <div className={CONTAINER}>
            <Cabecalho sobretitulo="para quem é" titulo="Feito para quem assina o pentest." />
            <ul className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-3">
              {PUBLICO.map((p) => (
                <li key={p.titulo} className="lp-painel lp-elevar lp-revelar flex flex-col rounded-2xl p-7">
                  <Icone nome={p.icone} className="h-6 w-6 text-texto-2" />
                  <h3 className="mt-5 text-lg font-semibold text-texto">{p.titulo}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-texto-2">{p.texto}</p>
                  <p className="mt-6 border-t border-white/[0.06] pt-4 text-sm text-texto lg:min-h-[4.25rem]">
                    <span className="text-accent">→ </span>
                    {p.ganho}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* -------------------------------------------------- Comparação */}
        <section id="comparacao" className="scroll-mt-20 border-t border-white/[0.06] py-24 sm:py-32">
          <div className={CONTAINER}>
            <Cabecalho
              sobretitulo="comparação"
              titulo={
                <>
                  O ciclo completo, <Destaque>por preço de freelancer.</Destaque>
                </>
              }
              texto="Geradores de relatório param no documento. Plataformas enterprise cobrem o ciclo, mas são em inglês e com preço sob consulta."
            />
            {/* relative: os textos sr-only (absolutos) ficam presos à rolagem
                da tabela em vez de alargar a página no celular. */}
            <div className="relative mt-12 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="text-sm">
                    <th scope="col" className="py-4 pr-4 font-normal text-texto-2">
                      <span className="sr-only">Recurso</span>
                    </th>
                    <th scope="col" className="w-36 rounded-t-xl bg-accent/[0.07] px-4 py-4 text-center font-semibold text-accent">
                      Provafix
                    </th>
                    <th scope="col" className="w-36 px-4 py-4 text-center font-normal text-texto-2">
                      Gerador de relatório
                    </th>
                    <th scope="col" className="w-36 px-4 py-4 text-center font-normal text-texto-2">
                      Plataforma enterprise
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARACAO.map((c, i) => (
                    <tr key={c.recurso} className="border-t border-white/[0.06]">
                      <th scope="row" className="py-4 pr-4 text-sm font-normal text-texto">
                        {c.recurso}
                      </th>
                      <td
                        className={`bg-accent/[0.07] px-4 py-4 text-center ${
                          i === COMPARACAO.length - 1 ? "rounded-b-xl" : ""
                        }`}
                      >
                        <ValorCelula valor={c.laudo} laudo />
                      </td>
                      <td className="px-4 py-4 text-center">
                        <ValorCelula valor={c.pdf} />
                      </td>
                      <td className="px-4 py-4 text-center">
                        <ValorCelula valor={c.enterprise} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ Preços */}
        <section id="precos" className="scroll-mt-20 border-t border-white/[0.06] py-24 sm:py-32">
          <div className={CONTAINER}>
            <Cabecalho
              centro
              sobretitulo="preços"
              titulo={
                <>
                  Comece grátis. <Destaque>Certifique no Pro.</Destaque>
                </>
              }
              texto="Sem cartão para começar. Cancele quando quiser, mantendo seus dados."
            />
            <div className="mx-auto mt-14 grid max-w-4xl grid-cols-1 gap-5 md:grid-cols-2">
              {PLANOS.map((p) => (
                <article
                  key={p.nome}
                  className={`lp-elevar relative flex flex-col rounded-2xl p-8 ${
                    p.destaque
                      ? "lp-painel ring-1 ring-accent/40 shadow-[0_0_80px_-30px_var(--color-accent)]"
                      : "border border-white/[0.08]"
                  }`}
                >
                  {p.destaque && (
                    <span className="absolute right-6 top-6 rounded-full bg-accent/[0.12] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
                      com certificado
                    </span>
                  )}
                  <h3 className="text-lg font-semibold text-texto">{p.nome}</h3>
                  <p className="mt-1 text-sm text-texto-2">{p.descricao}</p>
                  <p className="mt-6 flex items-baseline gap-1.5">
                    <span className="text-5xl font-semibold tracking-tight text-texto">{p.preco}</span>
                    <span className="text-sm text-texto-2">{p.periodo}</span>
                  </p>
                  <ul className="mt-8 flex flex-1 flex-col gap-3">
                    {p.itens.map((item) => (
                      <li key={item} className="flex items-start gap-3 text-sm text-texto-2">
                        <Icone nome="check" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={p.href}
                    className={`mt-9 ${p.destaque ? "lp-btn-primario" : "lp-btn-secundario"} w-full`}
                  >
                    {p.cta}
                  </a>
                </article>
              ))}
            </div>
            <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-texto-2">
              Consultoria? O <span className="text-texto">Team</span> (R$ 49,90/mês) inclui
              tudo do Pro e compartilha cada relatório com até 10 colegas, com comentários de
              revisão por achado. Plano anual com 20%
              de desconto —{" "}
              <a href="/precos" className="text-accent underline-offset-4 hover:underline">
                ver todos os planos
              </a>
              .
            </p>
          </div>
        </section>

        {/* --------------------------------------------------------- FAQ */}
        <section id="faq" className="scroll-mt-20 border-t border-white/[0.06] py-24 sm:py-32">
          <div className={`${CONTAINER} grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.6fr]`}>
            <div>
              <Cabecalho sobretitulo="dúvidas" titulo="Perguntas que todo pentester faz." />
              <p className="mt-5 text-base leading-relaxed text-texto-2">
                O código é aberto: o que não estiver aqui, está no{" "}
                <a href={REPOSITORIO} className="text-accent underline-offset-4 hover:underline">
                  GitHub
                </a>
                .
              </p>
            </div>
            <div className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
              {FAQ.map((f) => (
                <details key={f.pergunta} className="group py-1">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-base font-medium text-texto [&::-webkit-details-marker]:hidden">
                    {f.pergunta}
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 text-accent transition-transform duration-200 group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="pb-6 pr-12 text-[15px] leading-relaxed text-texto-2">{f.resposta}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------- CTA final */}
        <section className="px-4 pb-24 sm:px-6 sm:pb-32">
          <div className="lp-painel relative mx-auto max-w-6xl overflow-hidden rounded-3xl px-6 py-20 text-center sm:px-12 sm:py-24">
            <div aria-hidden="true" className="lp-aura absolute left-1/2 top-0 h-80 w-[44rem] -translate-x-1/2 -translate-y-1/2" />
            <Logo className="relative mx-auto h-12 w-12 text-accent" />
            <h2 className="relative mx-auto mt-8 max-w-3xl text-[2.2rem] font-semibold leading-[1.08] tracking-[-0.03em] text-texto sm:text-5xl">
              O relatório já foi entregue. <Destaque>Agora prove que acabou.</Destaque>
            </h2>
            <p className="relative mx-auto mt-6 max-w-xl text-lg text-texto-2">
              Crie a conta, gere o primeiro relatório e acompanhe as correções hoje.
            </p>
            <div className="relative mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <a href="/cadastro" className="lp-btn-primario">
                Começar grátis
                <Icone nome="seta" className="h-4 w-4" />
              </a>
              <a href="#certificado" className="lp-btn-secundario">
                Ver um certificado
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------- Rodapé */}
      <footer className="border-t border-white/[0.06]">
        <div className={`${CONTAINER} grid grid-cols-2 gap-10 py-14 sm:grid-cols-4`}>
          <div className="col-span-2 sm:col-span-1">
            <a href="/" className="flex items-center gap-2.5" aria-label="Provafix — início">
              <Logo className="h-7 w-7 text-accent" />
              <span className="font-semibold tracking-tight text-texto">Provafix</span>
            </a>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-texto-2">
              Assurance para pentest: do relatório à prova de correção.
            </p>
          </div>
          <nav aria-label="Produto" className="flex flex-col gap-3 text-sm">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-texto-2/70">Produto</p>
            <a href="#como-funciona" className="text-texto-2 transition-colors hover:text-texto">Como funciona</a>
            <a href="#certificado" className="text-texto-2 transition-colors hover:text-texto">Certificado</a>
            <a href="/precos" className="text-texto-2 transition-colors hover:text-texto">Preços</a>
            <a href="#faq" className="text-texto-2 transition-colors hover:text-texto">Dúvidas</a>
          </nav>
          <nav aria-label="Conta" className="flex flex-col gap-3 text-sm">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-texto-2/70">Conta</p>
            <a href="/login" className="text-texto-2 transition-colors hover:text-texto">Entrar</a>
            <a href="/cadastro" className="text-texto-2 transition-colors hover:text-texto">Criar conta</a>
          </nav>
          <nav aria-label="Legal e código" className="flex flex-col gap-3 text-sm">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-texto-2/70">Transparência</p>
            <a href="/termos" className="text-texto-2 transition-colors hover:text-texto">Termos</a>
            <a href="/privacidade" className="text-texto-2 transition-colors hover:text-texto">Privacidade</a>
            <a href={REPOSITORIO} className="text-texto-2 transition-colors hover:text-texto">Código-fonte (MIT)</a>
            <a href={`mailto:${EMAIL_CONTATO}`} className="text-texto-2 transition-colors hover:text-texto">Contato</a>
          </nav>
        </div>
        <div className="border-t border-white/[0.06]">
          <p className={`${CONTAINER} py-6 font-mono text-[11px] text-texto-2/60`}>
            © 2026 Provafix · feito no Brasil
          </p>
        </div>
      </footer>
    </div>
  );
}

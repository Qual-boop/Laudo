import type { Metadata } from "next";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Laudo — Relatórios de pentest profissionais em minutos, não dias",
  description:
    "Transforme anotações de teste em um relatório de pentest completo: capa, sumário executivo, escopo, achados com CVSS, recomendações e disclaimer.",
};

const SEÇÕES = [
  {
    icone: "▤",
    titulo: "Capa",
    texto: "Identificação do engagement: cliente, data, versão e classificação de confidencialidade.",
  },
  {
    icone: "◧",
    titulo: "Sumário executivo",
    texto:
      "Visão geral em linguagem de negócio, risco geral e distribuição dos achados por severidade.",
  },
  {
    icone: "◎",
    titulo: "Escopo e metodologia",
    texto: "O que foi testado, referências seguidas, ferramentas utilizadas, período e limitações.",
  },
  {
    icone: "▲",
    titulo: "Achados",
    texto:
      "Por achado: descrição técnica, impacto no negócio, evidências, passos de reprodução, CVSS, CWE, OWASP e remediação.",
  },
  {
    icone: "✦",
    titulo: "Recomendações gerais",
    texto: "Ações de hardening priorizadas, com justificativa — além das correções individuais.",
  },
  {
    icone: "◆",
    titulo: "Conclusão",
    texto: "Estado de segurança do alvo e próximos passos acordados.",
  },
  {
    icone: "§",
    titulo: "Disclaimer",
    texto: "Confidencialidade, autorização formal e obrigação de correção.",
  },
];

const PASSOS = [
  {
    numero: "01",
    titulo: "Cadastre o engagement",
    texto:
      "Cliente, escopo, período, ferramentas e limitações. O que ficar vazio vira “não informado” no documento.",
  },
  {
    numero: "02",
    titulo: "Adicione os achados",
    texto:
      "Título, severidade, CWE, descrição e evidência. A lista aceita quantos achados o teste tiver.",
  },
  {
    numero: "03",
    titulo: "Gere o relatório",
    texto:
      "A IA calcula CVSS, classifica OWASP, escreve impacto, passos de reprodução e remediação. Você revisa e exporta.",
  },
];

const DOR = [
  {
    titulo: "O teste leva horas, o relatório leva dias",
    texto:
      "Boa parte do tempo de um pentest vira reformatar achado em prosa Formal para um público que não lê sobre CVSS.",
  },
  {
    titulo: "Cada cliente exige um formato diferente",
    texto:
      "Diretoria quer resumo, time quer detalhe, dev quer ticket. São três leituras do mesmo achado — e três trabalhos de escrita.",
  },
  {
    titulo: "O trabalho não se acumula",
    texto:
      "O próximo relatório começa do zero. Nenhuma parte da escrita fica versionada, reutilizável ou comparável entre engagements.",
  },
];

const PUBLICO = [
  {
    titulo: "Pentesters freelancers",
    texto: "Um relatório convincente por semana sem passar a madrugada escrevendo.",
  },
  {
    titulo: "Consultorias pequenas",
    texto: "Padroniza a entrega entre contratos e reduz retrabalho na revisão interna.",
  },
  {
    titulo: "Times internos de segurança",
    texto: "Abrevia o ciclo entre achado e correção, com o impacto de negócio já escrito.",
  },
];

export default function Apresentacao() {
  return (
    <>
      <header className="no-print sticky top-0 z-10 border-b border-borda bg-fundo/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-6 sm:px-6">
          <Logo className="h-9 w-9 shrink-0 text-accent" />
          <span className="text-lg font-bold tracking-tight text-texto">Laudo</span>
          <nav className="ml-auto">
            <a
              href="/"
              className="rounded-md border border-accent px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-wider text-accent transition-colors duration-200 hover:bg-accent hover:text-fundo"
            >
              ir para o app
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-borda">
          <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28">
            <p className="font-mono text-[11px] uppercase tracking-widest text-accent">
              gerador de relatório de pentest
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight tracking-tight text-texto sm:text-6xl">
              Relatórios de pentest profissionais em minutos, não dias
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-texto-2 sm:text-lg">
              O teste leva horas. A escrita do relatório é o que trava a entrega.
              O Laudo transforma suas notas de teste em um documento completo —
              capa, sumário executivo, escopo, achados com CVSS, recomendações e
              disclaimer — pronto para o cliente.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="/"
                className="inline-flex cursor-pointer items-center justify-center rounded-md border border-accent bg-transparent px-6 py-3 font-mono text-xs font-medium uppercase tracking-wider text-accent transition-colors duration-200 hover:bg-accent hover:text-fundo sm:w-auto sm:px-8 sm:py-3.5"
              >
                Testar agora
              </a>
              <span className="font-mono text-[11px] text-texto-2">
                sem cadastro · os achados ficam no seu navegador
              </span>
            </div>
          </div>
        </section>

        {/* O problema */}
        <section className="border-b border-borda">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight text-texto sm:text-3xl">
              O problema
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-texto-2">
              Todo pentester já conhece essa parte do trabalho.
            </p>
            <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {DOR.map((item) => (
                <li
                  key={item.titulo}
                  className="rounded-md border border-borda bg-superficie p-5"
                >
                  <span
                    aria-hidden="true"
                    className="font-mono text-xs text-alta"
                  >
                    ✗
                  </span>
                  <h3 className="mt-3 text-sm font-semibold text-texto">
                    {item.titulo}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-texto-2">
                    {item.texto}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Como funciona */}
        <section className="border-b border-borda">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight text-texto sm:text-3xl">
              Como funciona
            </h2>
            <ol className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {PASSOS.map((passo) => (
                <li
                  key={passo.numero}
                  className="rounded-md border border-borda bg-superficie p-5"
                >
                  <span className="font-mono text-xs text-accent">
                    {passo.numero}
                  </span>
                  <h3 className="mt-3 text-sm font-semibold text-texto">
                    {passo.titulo}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-texto-2">
                    {passo.texto}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* O que está incluso */}
        <section className="border-b border-borda">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight text-texto sm:text-3xl">
              O que está incluso
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-texto-2">
              Sete seções no documento final, no padrão que um cliente espera
              receber.
            </p>
            <ul className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-borda bg-borda sm:grid-cols-2 lg:grid-cols-4">
              {SEÇÕES.map((secao) => (
                <li key={secao.titulo} className="bg-superficie p-5">
                  <span aria-hidden="true" className="font-mono text-sm text-accent">
                    {secao.icone}
                  </span>
                  <h3 className="mt-3 text-sm font-semibold text-texto">
                    {secao.titulo}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-texto-2">
                    {secao.texto}
                  </p>
                </li>
              ))}
              <li className="bg-superficie p-5">
                <span aria-hidden="true" className="font-mono text-sm text-accent">
                  ⇩
                </span>
                <h3 className="mt-3 text-sm font-semibold text-texto">Exportação</h3>
                <p className="mt-2 text-xs leading-relaxed text-texto-2">
                  PDF paginado em A4 com capa isolada e quebras por seção.
                </p>
              </li>
            </ul>
          </div>
        </section>

        {/* Para quem é */}
        <section className="border-b border-borda">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight text-texto sm:text-3xl">
              Para quem é
            </h2>
            <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {PUBLICO.map((p) => (
                <li
                  key={p.titulo}
                  className="rounded-md border border-borda bg-superficie p-5"
                >
                  <h3 className="text-sm font-semibold text-texto">{p.titulo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-texto-2">
                    {p.texto}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTA final */}
        <section>
          <div className="mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 sm:py-28">
            <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-texto sm:text-4xl">
              Já tem o achado. Falta só escrever.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-texto-2">
              Abra o gerador, cole suas notas e exporte o relatório.
            </p>
            <a
              href="/"
              className="mt-10 inline-flex cursor-pointer items-center justify-center rounded-md border border-accent bg-accent px-8 py-3.5 font-mono text-xs font-medium uppercase tracking-wider text-fundo transition-colors duration-200 hover:bg-transparent hover:text-accent"
            >
              Testar grátis
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-borda">
        <div className="mx-auto max-w-5xl px-4 py-8 text-center font-mono text-[11px] text-texto-2/60 sm:px-6">
          MVP em desenvolvimento — feedback bem-vindo
        </div>
      </footer>
    </>
  );
}

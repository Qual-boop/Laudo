import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { TerminalBar } from "@/components/TerminalBar";

export const metadata: Metadata = {
  title: "Laudo — Prove que as correções funcionaram",
  description:
    "Plataforma de assurance que fecha o ciclo do pentest: gera o relatório, acompanha o reteste e entrega o certificado de que as falhas foram corrigidas.",
};

const PASSOS = [
  {
    numero: "01",
    titulo: "Cadastre o engagement e os achados",
    texto:
      "Cliente, escopo, período, ferramentas e limitações. Cada achado entra com severidade, CWE, evidência e o quanto você confia nele.",
  },
  {
    numero: "02",
    titulo: "Gere o relatório completo com IA",
    texto:
      "Sete seções: capa, sumário executivo, escopo, achados com CVSS e OWASP, recomendações, conclusão e disclaimer.",
  },
  {
    numero: "03",
    titulo: "Registre o reteste com evidência",
    texto:
      "Data, resultado (corrigido, não corrigido ou parcial) e a evidência que comprova. O histórico de cada reteste fica guardado.",
  },
  {
    numero: "04",
    titulo: "Entregue o Delta e o Certificado",
    texto:
      "Relatório de delta antes vs depois e, com 100% dos achados verificados, o certificado de correção com hash de verificação.",
  },
];

const RECURSOS = [
  {
    icone: "▤",
    titulo: "Relatório de 7 seções",
    texto: "Capa, sumário, escopo, achados, recomendações, conclusão e disclaimer.",
  },
  {
    icone: "▲",
    titulo: "Achados com CVSS, OWASP e CWE",
    texto: "Vetor de ataque, passos de reprodução e remediação em curto e longo prazo.",
  },
  {
    icone: "◷",
    titulo: "Motor de verificação",
    texto: "Status por achado: pendente, verificado ou não corrigido. Com filtro e progresso.",
  },
  {
    icone: "⇄",
    titulo: "Relatório de delta",
    texto: "O que mudou entre o achado original e o reteste, com a evidência de cada um.",
  },
  {
    icone: "⎙",
    titulo: "Exportação em PDF, Jira e GitHub",
    texto: "Paginação A4, capa isolada e exportação por achado em 3 formatos.",
  },
  {
    icone: "⇌",
    titulo: "Fallback entre provedores de IA",
    texto: "Gemini, depois Groq, depois relatório local. Nunca fica sem resposta.",
  },
];

const PUBLICO = [
  {
    titulo: "Pentesters freelancers",
    texto: "Feche o ciclo do engagement sem maintainers nem cobros extras.",
  },
  {
    titulo: "Consultorias pequenas",
    texto: "Até 10 pessoas padronizam a entrega e provam a correção sem planilha.",
  },
  {
    titulo: "Times internos ofensivos",
    texto: "O time de dev recebe achado rastreável e o status fecha o ticket.",
  },
];

const DOR = [
  {
    titulo: "Você entrega o relatório. O cliente paga. E depois?",
    texto:
      "O engagement acaba no PDF. Ninguém tem o que mostrar na reunião de acompanhamento.",
  },
  {
    titulo: "Ninguém sabe se as vulnerabilidades foram corrigidas de verdade.",
    texto:
      "O time de dev diz que arrumou. Sem reteste com evidência, é só uma afirmação sem prova.",
  },
  {
    titulo: "Sem prova de correção, o pentest vira só mais um PDF na gaveta.",
    texto:
      "O mesmo teste do ano passado vira a mesma pergunta: quais continuam abertas?",
  },
];

const DIFERENCIAL = [
  {
    titulo: "Outras ferramentas param quando você clica em “exportar”.",
    texto:
      "Geram documento bonito e devolvem o controle. A garantia continua sendo uma promessa sua.",
  },
  {
    titulo: "O Laudo continua até você ter prova de que a correção foi aplicada.",
    texto:
      "O achado não some depois do PDF. Ele ganha status, histórico de reteste e evidência.",
  },
  {
    titulo: "Seu cliente não compra um relatório. Ele compra a garantia de que o problema sumiu.",
    texto:
      "O certificado de correção é o entregável que fecha o ciclo — com hash de verificação e data de emissão.",
  },
];

/* Comparação honesta: o que cada categoria entrega. */
const COMPARACAO: { recurso: string; laudo: boolean; pdf: boolean; enterprise: boolean }[] = [
  { recurso: "Relatório com IA (CVSS, OWASP)", laudo: true, pdf: false, enterprise: true },
  { recurso: "Reteste com evidência", laudo: true, pdf: false, enterprise: true },
  { recurso: "Certificado de correção com hash", laudo: true, pdf: false, enterprise: false },
  { recurso: "Exportação Jira / GitHub por achado", laudo: true, pdf: false, enterprise: true },
  { recurso: "Preço de freelancer (a partir de R$ 19,90)", laudo: true, pdf: true, enterprise: false },
  { recurso: "Auto-hospedável e leve", laudo: true, pdf: true, enterprise: false },
];

/* ------------------------------------------------------------------ *
 * Mockup estático do painel de verificação — deixa o hero mostrar o
 * produto em vez de descrever o produto.
 * ------------------------------------------------------------------ */

const MOCK = [
  {
    ref: "FINDING-001",
    titulo: "SQL Injection no formulário de login",
    severidade: "Crítica",
    cor: "critica",
    status: "Verificado",
    statusCor: "accent",
    icone: "✓",
    progresso: "w-full",
    tempo: "há 2 dias",
  },
  {
    ref: "FINDING-002",
    titulo: "IDOR no endpoint de faturas",
    severidade: "Alta",
    cor: "alta",
    status: "Não corrigido",
    statusCor: "critica",
    icone: "✗",
    progresso: "w-1/3",
    tempo: "há 9 dias",
  },
  {
    ref: "FINDING-003",
    titulo: "Cookie de sessão sem HttpOnly",
    severidade: "Média",
    cor: "media",
    status: "Pendente",
    statusCor: "media",
    icone: "○",
    progresso: "w-0",
    tempo: "aguardando reteste",
  },
];

const BOTAO = (extra = "") =>
  `inline-flex items-center justify-center rounded-md border px-4 py-2 font-mono text-[10px] uppercase tracking-wider transition-colors duration-200 ${extra}`;

function Celula({ sim }: { sim: boolean }) {
  return (
    <span
      aria-label={sim ? "Incluso" : "Não incluso"}
      className={`font-mono text-sm ${sim ? "text-accent" : "text-texto-2/40"}`}
    >
      {sim ? "✓" : "—"}
    </span>
  );
}

export default function Landing() {
  return (
    <>
      <header className="no-print sticky top-0 z-10 border-b border-borda bg-fundo/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-5 sm:px-6">
          <Logo className="h-9 w-9 shrink-0 text-accent" />
          <span className="text-lg font-bold tracking-tight text-texto">Laudo</span>
          <nav className="ml-auto flex items-center gap-2">
            <a
              href="#como-funciona"
              className={`${BOTAO("border-transparent text-texto-2 hover:border-borda hover:text-texto")} hidden sm:inline-flex`}
            >
              Como funciona
            </a>
            <a
              href="/login"
              className={`${BOTAO("border-borda text-texto-2 hover:border-accent hover:text-accent")}`}
            >
              Entrar
            </a>
            <a
              href="/cadastro"
              className={`${BOTAO("border-accent text-accent hover:bg-accent hover:text-fundo")}`}
            >
              Criar conta
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* ------------------------------------------------ Hero */}
        <section className="border-b border-borda">
          <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-accent">
                plataforma de assurance
              </p>
              <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight text-texto sm:text-5xl">
                Prove que as correções funcionaram
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-texto-2">
                O Laudo fecha o ciclo do pentest: gera o relatório, acompanha o
                reteste e entrega o certificado de que as falhas foram
                corrigidas.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a
                  href="/cadastro"
                  className={`${BOTAO("border-accent bg-accent px-6 py-3 text-xs text-fundo hover:bg-transparent hover:text-accent")} cursor-pointer`}
                >
                  Criar conta grátis
                </a>
                <a
                  href="#como-funciona"
                  className={`${BOTAO("border-borda px-6 py-3 text-xs text-texto-2 hover:border-accent hover:text-accent")} cursor-pointer`}
                >
                  Ver como funciona
                </a>
              </div>
              <p className="mt-5 font-mono text-[11px] text-texto-2">
                grátis para começar · sem cartão
              </p>
            </div>

            {/* Mockup do painel de verificação */}
            <div className="relative">
              <div className="rounded-lg border border-borda bg-superficie shadow-lg">
                <TerminalBar aoVivo>
                  laudo@pentest:~/verificacao
                </TerminalBar>

                <div className="flex flex-col gap-4 p-4 sm:p-5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-medium text-texto">
                      1 de 3 achados verificados
                    </span>
                    <span className="font-mono text-[10px] text-texto-2">
                      33%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-sm bg-borda">
                    <div className="h-full w-1/3 bg-media" />
                  </div>

                  {MOCK.map((m) => (
                    <div
                      key={m.ref}
                      className="rounded-md border border-borda bg-superficie-2 p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex h-4 w-4 items-center justify-center rounded-sm text-[10px] ${
                            m.statusCor === "accent"
                              ? "bg-accent/15 text-accent"
                              : m.statusCor === "critica"
                                ? "bg-critica/15 text-critica"
                                : "bg-media/15 text-media"
                          }`}
                        >
                          {m.icone}
                        </span>
                        <span className="font-mono text-[9px] tracking-wider text-accent">
                          {m.ref}
                        </span>
                        <span
                          className={`font-mono text-[9px] uppercase tracking-wider ${
                            m.cor === "critica"
                              ? "text-critica"
                              : m.cor === "alta"
                                ? "text-alta"
                                : "text-media"
                          }`}
                        >
                          {m.severidade}
                        </span>
                        <span
                          className={`ml-auto font-mono text-[9px] uppercase tracking-wider ${
                            m.statusCor === "accent"
                              ? "text-accent"
                              : m.statusCor === "critica"
                                ? "text-critica"
                                : "text-media"
                          }`}
                        >
                          {m.status}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-snug text-texto">
                        {m.titulo}
                      </p>
                      <div className="mt-2.5 flex items-center gap-2">
                        <div className="h-0.5 flex-1 overflow-hidden rounded-sm bg-borda">
                          <div
                            className={`h-full ${
                              m.statusCor === "accent"
                                ? "bg-accent"
                                : m.statusCor === "critica"
                                  ? "bg-critica"
                                  : "bg-borda"
                            } ${m.progresso}`}
                          />
                        </div>
                        <span className="font-mono text-[9px] text-texto-2">
                          {m.tempo}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="mt-3 text-center font-mono text-[10px] text-texto-2">
                painel de verificação · ciclo de correção
              </p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------ O problema */}
        <section className="border-b border-borda">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight text-texto sm:text-3xl">
              O problema
            </h2>
            <ul className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-3">
              {DOR.map((item) => (
                <li
                  key={item.titulo}
                  className="rounded-lg border border-borda bg-superficie p-5 transition-colors duration-200 hover:border-critica/40"
                >
                  <span aria-hidden="true" className="font-mono text-xs text-critica">
                    ✗
                  </span>
                  <h3 className="mt-3 text-sm font-semibold leading-snug text-texto">
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

        {/* --------------------------------------- Como funciona */}
        <section id="como-funciona" className="scroll-mt-20 border-b border-borda">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight text-texto sm:text-3xl">
              Como funciona
            </h2>
            <ol className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PASSOS.map((p) => (
                <li
                  key={p.numero}
                  className="rounded-lg border border-borda bg-superficie p-5 transition-colors duration-200 hover:border-accent/40"
                >
                  <span className="font-mono text-xs text-accent">{p.numero}</span>
                  <h3 className="mt-3 text-sm font-semibold leading-snug text-texto">
                    {p.titulo}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-texto-2">
                    {p.texto}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* -------------------------------------- O que inclui */}
        <section className="border-b border-borda">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight text-texto sm:text-3xl">
              O que está incluso
            </h2>
            <ul className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-borda bg-borda sm:grid-cols-2 lg:grid-cols-3">
              {RECURSOS.map((r) => (
                <li
                  key={r.titulo}
                  className="bg-superficie p-5 transition-colors duration-200 hover:bg-superficie-2"
                >
                  <span aria-hidden="true" className="font-mono text-sm text-accent">
                    {r.icone}
                  </span>
                  <h3 className="mt-3 text-sm font-semibold text-texto">
                    {r.titulo}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-texto-2">
                    {r.texto}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------------------------------------- Para quem é */}
        <section className="border-b border-borda">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight text-texto sm:text-3xl">
              Para quem é
            </h2>
            <ul className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-3">
              {PUBLICO.map((p) => (
                <li
                  key={p.titulo}
                  className="rounded-lg border border-borda bg-superficie p-5"
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

        {/* ------------------------------------- Diferencial */}
        <section className="border-b border-borda">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight text-texto sm:text-3xl">
              Por que não somos mais um gerador de PDF
            </h2>
            <ul className="mt-10 flex flex-col gap-4">
              {DIFERENCIAL.map((d) => (
                <li
                  key={d.titulo}
                  className="flex flex-col gap-3 rounded-lg border border-accent/25 bg-accent/[0.04] p-5 sm:flex-row sm:gap-4"
                >
                  <span
                    aria-hidden="true"
                    className="shrink-0 font-mono text-sm text-accent"
                  >
                    ✓
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold leading-snug text-texto">
                      {d.titulo}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-texto-2">
                      {d.texto}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------- Comparação */}
        <section className="border-b border-borda">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight text-texto sm:text-3xl">
              Comparação
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-texto-2">
              Geradores de PDF param no documento. Plataformas enterprise
              cobrem o ciclo todo, mas custam como enterprise. O Laudo fecha
              o ciclo por preço de freelancer.
            </p>
            <div className="mt-10 overflow-x-auto rounded-lg border border-borda">
              <table className="w-full min-w-[560px] border-collapse bg-superficie text-left text-sm">
                <thead>
                  <tr className="border-b border-borda font-mono text-[11px] uppercase tracking-wider text-texto-2">
                    <th scope="col" className="px-5 py-4 font-medium">Recurso</th>
                    <th scope="col" className="px-5 py-4 font-medium text-accent">Laudo</th>
                    <th scope="col" className="px-5 py-4 font-medium">Gerador de PDF</th>
                    <th scope="col" className="px-5 py-4 font-medium">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARACAO.map((c) => (
                    <tr key={c.recurso} className="border-b border-borda last:border-0">
                      <th scope="row" className="px-5 py-3.5 text-sm font-normal text-texto">
                        {c.recurso}
                      </th>
                      <td className="px-5 py-3.5"><Celula sim={c.laudo} /></td>
                      <td className="px-5 py-3.5"><Celula sim={c.pdf} /></td>
                      <td className="px-5 py-3.5"><Celula sim={c.enterprise} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ------------------------------------------- CTA */}
        <section>
          <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28">
            <h2 className="mx-auto max-w-3xl text-3xl font-bold tracking-tight text-texto sm:text-4xl">
              O relatório já foi entregue. Agora prove que acabou.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-texto-2">
              Crie sua conta, gere o relatório e comece a acompanhar as
              correções hoje.
            </p>
            <a
              href="/cadastro"
              className={`${BOTAO("mt-10 cursor-pointer border-accent bg-accent px-8 py-3.5 text-xs text-fundo hover:bg-transparent hover:text-accent")}`}
            >
              Criar conta grátis
            </a>
            <p className="mt-6 font-mono text-[11px] text-texto-2/70">
              Pro R$ 19,90/mês · Team R$ 49,90/mês quando sair do beta.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-borda">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 font-mono text-[11px] text-texto-2/60 sm:flex-row sm:px-6">
          <span>Laudo · plataforma de assurance para pentest</span>
          <nav className="flex items-center gap-5" aria-label="Links legais">
            <a href="/termos" className="transition-colors hover:text-accent">
              Termos
            </a>
            <a href="/privacidade" className="transition-colors hover:text-accent">
              Privacidade
            </a>
            <a
              href="mailto:contato@laudo.app"
              className="transition-colors hover:text-accent"
            >
              Contato
            </a>
          </nav>
        </div>
      </footer>
    </>
  );
}

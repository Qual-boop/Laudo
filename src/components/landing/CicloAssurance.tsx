import { Icone, type NomeIcone } from "@/components/landing/Icone";

const ETAPAS: { nome: string; texto: string; icone: NomeIcone }[] = [
  { nome: "Achado", texto: "Evidência, CWE e severidade", icone: "alvo" },
  { nome: "Relatório", texto: "Sete seções, com IA", icone: "documento" },
  { nome: "Correção", texto: "O time de dev aplica", icone: "codigo" },
  { nome: "Reteste", texto: "Resultado com evidência", icone: "radar" },
  { nome: "Certificado", texto: "Prova com hash SHA-256", icone: "hash" },
];

/** Onde o pentest costuma parar (no PDF) vs. onde o Laudo termina (na prova). */
export function CicloAssurance() {
  return (
    <div>
      {/* Chaves (desktop): o alcance de cada abordagem sobre as etapas. */}
      <div aria-hidden="true" className="hidden lg:block">
        <div className="grid grid-cols-5">
          <div className="col-span-2 px-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-texto-2">
              geradores de relatório param aqui
            </p>
            <div className="mt-2 h-3 rounded-t-md border-x border-t border-dashed border-white/25" />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-5">
          <div className="col-span-5 px-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">
              o laudo vai até a prova
            </p>
            <div className="mt-2 h-3 rounded-t-md border-x border-t border-accent/60" />
          </div>
        </div>
      </div>

      <ol className="relative mt-2 grid grid-cols-1 gap-3 lg:mt-6 lg:grid-cols-5 lg:gap-0">
        {/* trilho horizontal atrás dos nós (desktop) */}
        <span
          aria-hidden="true"
          className="absolute left-[10%] right-[10%] top-7 hidden h-px bg-gradient-to-r from-white/15 via-white/15 to-accent/70 lg:block"
        />
        {ETAPAS.map((e, i) => {
          const final = i === ETAPAS.length - 1;
          return (
            <li
              key={e.nome}
              className="relative flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 lg:flex-col lg:border-0 lg:bg-transparent lg:p-0 lg:text-center"
            >
              <span
                className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border ${
                  final
                    ? "border-accent/60 bg-accent/[0.12] text-accent shadow-[0_0_40px_-8px_var(--color-accent)]"
                    : "border-white/10 bg-fundo text-texto-2"
                }`}
              >
                <Icone nome={e.icone} className="h-6 w-6" />
              </span>
              <div className="lg:mt-4">
                <p className={`text-base font-semibold ${final ? "text-accent" : "text-texto"}`}>
                  <span className="mr-1.5 font-mono text-xs text-texto-2">0{i + 1}</span>
                  {e.nome}
                </p>
                <p className="mt-0.5 text-sm text-texto-2">{e.texto}</p>
                {i === 1 && (
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-texto-2/70 lg:hidden">
                    ↳ geradores de relatório param aqui
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

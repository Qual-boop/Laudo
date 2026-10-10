import type { ReactNode } from "react";

export type ResumoGeral = {
  relatorios: number;
  pendentes: number;
  verificados: number;
  naoCorrigidos: number;
};

type Props = {
  resumo: ResumoGeral | null;
  children: ReactNode;
};

/**
 * Barra lateral de status. Fixa em telas grandes (lg+); some no mobile para
 * não empurrar o conteúdo nem quebrar o layout de coluna única.
 */
export function LayoutComSidebar({ resumo, children }: Props) {
  return (
    <div className="mx-auto flex w-full max-w-6xl gap-6 px-4 py-6 sm:px-6">
      <aside className="no-print hidden w-56 shrink-0 lg:block">
        <div className="sticky top-24 flex flex-col gap-3">
          <div className="rounded-md border border-borda bg-superficie p-4">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
              status
            </h2>

            <dl className="mt-3 flex flex-col gap-2.5">
              <Linha
                rotulo="relatórios"
                valor={resumo?.relatorios}
                cor="text-texto"
              />
              <Linha
                rotulo="verificados"
                valor={resumo?.verificados}
                cor="text-accent"
              />
              <Linha
                rotulo="não corrigidos"
                valor={resumo?.naoCorrigidos}
                cor="text-critica"
              />
              <Linha
                rotulo="pendentes"
                valor={resumo?.pendentes}
                cor="text-media"
              />
            </dl>
          </div>

          <p className="px-1 font-mono text-[10px] leading-relaxed text-texto-2/70">
            laudo v0.2 · assurance de pentest
          </p>
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Linha({
  rotulo,
  valor,
  cor,
}: {
  rotulo: string;
  valor: number | undefined;
  cor: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-xs text-texto-2">{rotulo}</dt>
      <dd className={`font-mono text-sm font-semibold tabular-nums ${cor}`}>
        {valor ?? "—"}
      </dd>
    </div>
  );
}

import { SeverityBadge } from "@/components/SeverityBadge";
import { Secao } from "@/components/relatorio/Secao";
import type { RecomendacaoGeral, Relatorio } from "@/lib/tipos";

function RelatorioRecomendacoes({
  recomendacoes,
}: {
  recomendacoes: RecomendacaoGeral[];
}) {
  if (recomendacoes.length === 0) return null;

  return (
    <Secao numero="04" titulo="Recomendações Gerais" quebra>
      <ol className="flex flex-col gap-3">
        {recomendacoes.map((rec, i) => (
          <li
            key={i}
            className="print-detalhe flex flex-col gap-2 rounded-md border border-borda bg-superficie p-4 sm:flex-row sm:gap-4"
          >
            <span className="shrink-0 font-mono text-xs text-accent tabular-nums">
              R{String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severidade={rec.prioridade} />
              </div>
              <p className="mt-2 text-sm font-medium leading-relaxed text-texto">
                {rec.recomendacao}
              </p>
              {rec.justificativa && (
                <p className="mt-1.5 text-sm leading-relaxed text-texto-2">
                  {rec.justificativa}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Secao>
  );
}

function RelatorioConclusao({ relatorio }: { relatorio: Relatorio }) {
  return (
    <>
      <Secao numero="05" titulo="Conclusão">
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-texto/90 sm:text-base">
          {relatorio.conclusao}
        </p>
      </Secao>

      <div className="print-detalhe mt-8 rounded-md border border-borda bg-superficie-2 p-4">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
          disclaimer
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-texto-2">
          {relatorio.disclaimer}
        </p>
      </div>
    </>
  );
}

export { RelatorioRecomendacoes, RelatorioConclusao };

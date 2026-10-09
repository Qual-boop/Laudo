import { RiscoGeralBadge } from "@/components/relatorio/SeloCvss";
import { ItemLista, Lista, Secao } from "@/components/relatorio/Secao";
import type { SumarioExecutivo as DadosSumario } from "@/lib/tipos";

const BARRAS = [
  { chave: "critica", rotulo: "Crítica", barra: "bg-critica", texto: "text-critica" },
  { chave: "alta", rotulo: "Alta", barra: "bg-alta", texto: "text-alta" },
  { chave: "media", rotulo: "Média", barra: "bg-media", texto: "text-media" },
  { chave: "baixa", rotulo: "Baixa", barra: "bg-baixa", texto: "text-baixa" },
] as const;

export function RelatorioSumario({
  sumario,
}: {
  sumario: DadosSumario;
}) {
  const { resumoPorSeveridade: resumo, totalAchados } = sumario;
  const maior = Math.max(1, ...BARRAS.map((b) => resumo[b.chave]));

  return (
    <Secao numero="01" titulo="Sumário Executivo">
      <div className="print-detalhe rounded-md border border-borda bg-superficie p-5 sm:p-6">
        <p className="text-sm leading-relaxed text-texto/90 sm:text-base">
          {sumario.visaoGeral}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <RiscoGeralBadge risco={sumario.riscoGeral} />
          <span className="font-mono text-[11px] uppercase tracking-widest text-texto-2">
            {totalAchados} achado{totalAchados === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {BARRAS.map((b) => {
          const qtd = resumo[b.chave];
          return (
            <div
              key={b.chave}
              className="print-detalhe rounded-md border border-borda bg-superficie px-4 py-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
                  {b.rotulo}
                </span>
                <span className={`font-mono text-lg font-semibold tabular-nums ${b.texto}`}>
                  {qtd}
                </span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-sm bg-borda">
                <div
                  className={`h-full ${b.barra}`}
                  style={{ width: `${(qtd / maior) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {sumario.principaisRiscos.length > 0 && (
        <div className="mt-7">
          <h3 className="print-detalhe font-mono text-[10px] uppercase tracking-widest text-texto-2">
            principais riscos de negócio
          </h3>
          <Lista>
            {sumario.principaisRiscos.map((risco, i) => (
              <ItemLista key={i}>{risco}</ItemLista>
            ))}
          </Lista>
        </div>
      )}
    </Secao>
  );
}

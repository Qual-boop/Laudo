import type { SumarioExecutivo } from "@/lib/tipos";

export function ResumoVisual({ sumario }: { sumario: SumarioExecutivo }) {
  const { resumoPorSeveridade, totalAchados, riscoGeral, principaisRiscos } = sumario;

  const dadosGrafico = [
    { severidade: "Crítica", valor: resumoPorSeveridade.critica, cor: "bg-critica" },
    { severidade: "Alta", valor: resumoPorSeveridade.alta, cor: "bg-alta" },
    { severidade: "Média", valor: resumoPorSeveridade.media, cor: "bg-media" },
    { severidade: "Baixa", valor: resumoPorSeveridade.baixa, cor: "bg-baixa" },
  ];

  const maxValor = Math.max(1, ...dadosGrafico.map((d) => d.valor));

  return (
    <div className="print-detalhe grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <div className="lg:col-span-2 print-detalhe rounded-md border border-borda bg-superficie p-5 sm:p-6">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
          visão geral do risco
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-texto/90 sm:text-base">
          {sumario.visaoGeral}
        </p>
      </div>

      <div className="print-detalhe rounded-md border border-borda bg-superficie p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
            risco geral
          </h3>
          <span
            className={`rounded-md border px-2 py-1 font-mono text-xs uppercase tracking-wider ${
              riscoGeral === "Critico"
                ? "border-critica/40 bg-critica/10 text-critica"
                : riscoGeral === "Alto"
                ? "border-alta/40 bg-alta/10 text-alta"
                : riscoGeral === "Medio"
                ? "border-media/40 bg-media/10 text-media"
                : "border-baixa/40 bg-baixa/10 text-baixa"
            }`}
          >
            {riscoGeral}
          </span>
        </div>
        <p className="mt-4 text-4xl font-bold tabular-nums text-texto">
          {totalAchados}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
          achados no total
        </p>
      </div>

      <div className="print-detalhe rounded-md border border-borda bg-superficie p-5 sm:p-6">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
          distribuição por severidade
        </h3>
        <div className="mt-4 flex flex-col gap-3">
          {dadosGrafico.map((d) => (
            <div key={d.severidade}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
                  {d.severidade}
                </span>
                <span className={`font-mono text-sm font-semibold tabular-nums ${d.cor.replace("bg-", "text-")}`}>
                  {d.valor}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-borda/30">
                <div
                  className={`h-full ${d.cor}`}
                  style={{ width: `${(d.valor / maxValor) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {principaisRiscos.length > 0 && (
        <div className="lg:col-span-4 print-detalhe rounded-md border border-borda bg-superficie p-5 sm:p-6">
          <h3 className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
            principais riscos de negócio
          </h3>
          <ol className="mt-3 flex flex-col gap-2">
            {principaisRiscos.map((risco, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-texto/90">
                <span className="shrink-0 font-mono text-xs text-accent tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{risco}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
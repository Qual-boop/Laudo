import type { Achado } from "@/lib/tipos";

type EventoTimeline = {
  id: string;
  titulo: string;
  severidade: Achado["severidade"];
  data: string;
  tipo: "achado" | "reteste" | "certificado";
};

function parseDataSegura(d: string | null): Date | null {
  if (!d) return null;
  const partes = d.split("-");
  if (partes.length !== 3) return null;
  const data = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
  return isNaN(data.getTime()) ? null : data;
}

export function TimelineAchados({
  achados,
  retestes,
}: {
  achados: Achado[];
  retestes?: Array<{ achadoId: string; data: string; resultado: string }>;
}) {
  const eventos: EventoTimeline[] = [];

  for (const achado of achados) {
    const dataSugerida = parseDataSegura(achado.dataRetesteSugerida);
    eventos.push({
      id: achado.id,
      titulo: achado.titulo,
      severidade: achado.severidade,
      data: dataSugerida?.toISOString().split("T")[0] ?? "Data não definida",
      tipo: "achado",
    });
  }

  if (retestes) {
    for (const reteste of retestes) {
      const data = parseDataSegura(reteste.data);
      if (data) {
        eventos.push({
          id: `${reteste.achadoId}-reteste`,
          titulo: `Reteste: ${reteste.resultado}`,
          severidade: "Media",
          data: data.toISOString().split("T")[0],
          tipo: "reteste",
        });
      }
    }
  }

  eventos.sort((a, b) => a.data.localeCompare(b.data));

  if (eventos.length === 0) {
    return (
      <div className="print-detalhe rounded-md border border-dashed border-borda bg-superficie/60 p-8 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
          linha do tempo
        </p>
        <p className="mt-2 text-sm text-texto-2">Nenhum evento para exibir.</p>
      </div>
    );
  }

  const coresTipo: Record<EventoTimeline["tipo"], string> = {
    achado: "bg-accent",
    reteste: "bg-media",
    certificado: "bg-sucesso",
  };

  const iconesTipo: Record<EventoTimeline["tipo"], string> = {
    achado: "◆",
    reteste: "⟳",
    certificado: "✓",
  };

  return (
    <div className="print-detalhe">
      <h3 className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
        linha do tempo do engagement
      </h3>
      <p className="mt-1.5 text-xs text-texto-2/70">
        Ordenação cronológica dos achados e retestes registrados.
      </p>

      <ul className="mt-4 flex flex-col gap-4" role="list">
        {eventos.map((evento, idx) => {
          const dataFormatada = evento.data;
          const cor = coresTipo[evento.tipo];
          const icone = iconesTipo[evento.tipo];
          const isLast = idx === eventos.length - 1;

          return (
            <li key={evento.id} className="relative flex gap-4">
              <div className="relative flex flex-col items-center shrink-0">
                <span
                  className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-fundo ${cor} font-mono text-[11px] text-fundo`}
                  aria-hidden="true"
                >
                  {icone}
                </span>
                {!isLast && (
                  <span
                    className="mt-1 h-full w-[2px] border-l border-borda/30"
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <time className="font-mono text-xs text-texto-2" dateTime={dataFormatada}>
                    {dataFormatada}
                  </time>
                  <span className="rounded-sm border border-borda/30 bg-superficie-2 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-texto-2">
                    {evento.tipo === "achado" ? "achado" : evento.tipo === "reteste" ? "reteste" : "certificado"}
                  </span>
                  {evento.severidade && evento.tipo === "achado" && (
                    <span
                      className={`rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                        evento.severidade === "Critica"
                          ? "border-critica/40 bg-critica/10 text-critica"
                          : evento.severidade === "Alta"
                          ? "border-alta/40 bg-alta/10 text-alta"
                          : evento.severidade === "Media"
                          ? "border-media/40 bg-media/10 text-media"
                          : "border-baixa/40 bg-baixa/10 text-baixa"
                      }`}
                    >
                      {evento.severidade.toLowerCase()}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-texto">{evento.titulo}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
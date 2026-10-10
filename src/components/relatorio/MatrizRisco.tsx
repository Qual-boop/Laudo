import type { Achado, Severidade } from "@/lib/tipos";

type CelulaRisco = {
  severidade: Severidade;
  probabilidade: "Alta" | "Média" | "Baixa";
  achados: Achado[];
};

const PROBABILIDADES: Array<"Alta" | "Média" | "Baixa"> = ["Alta", "Média", "Baixa"];
const SEVERIDADES_ORDEM: Severidade[] = ["Critica", "Alta", "Media", "Baixa"];

function inferirProbabilidade(achado: Achado): "Alta" | "Média" | "Baixa" {
  const { confianca, cvss } = achado;
  if (confianca === "Alta" && cvss.score >= 7) return "Alta";
  if (confianca === "Baixa" || cvss.score < 4) return "Baixa";
  return "Média";
}

function montarMatriz(achados: Achado[]): CelulaRisco[][] {
  const mapa = new Map<string, Achado[]>();

  for (const achado of achados) {
    const prob = inferirProbabilidade(achado);
    const chave = `${achado.severidade}-${prob}`;
    const existentes = mapa.get(chave) ?? [];
    existentes.push(achado);
    mapa.set(chave, existentes);
  }

  return SEVERIDADES_ORDEM.map((severidade) =>
    PROBABILIDADES.map((probabilidade) => ({
      severidade,
      probabilidade,
      achados: mapa.get(`${severidade}-${probabilidade}`) ?? [],
    })),
  );
}

function corProbabilidade(p: "Alta" | "Média" | "Baixa"): string {
  switch (p) {
    case "Alta":
      return "bg-critica/20 border-critica/40";
    case "Média":
      return "bg-alta/20 border-alta/40";
    case "Baixa":
      return "bg-media/20 border-media/40";
  }
}

function corSeveridade(s: Severidade): string {
  switch (s) {
    case "Critica":
      return "bg-critica/10 border-critica/30";
    case "Alta":
      return "bg-alta/10 border-alta/30";
    case "Media":
      return "bg-media/10 border-media/30";
    case "Baixa":
      return "bg-baixa/10 border-baixa/30";
  }
}

export function MatrizRisco({ achados }: { achados: Achado[] }) {
  const matriz = montarMatriz(achados);
  const totalAchados = achados.length;

  if (totalAchados === 0) {
    return (
      <div className="print-detalhe rounded-md border border-dashed border-borda bg-superficie/60 p-8 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
          matriz de risco
        </p>
        <p className="mt-2 text-sm text-texto-2">Nenhum achado para compor a matriz.</p>
      </div>
    );
  }

  return (
    <div className="print-detalhe">
      <h3 className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
        matriz de risco · impacto × probabilidade
      </h3>
      <p className="mt-1.5 text-xs text-texto-2/70">
        Baseada em CVSS e confiança do pentester. Células coloridas indicam
        concentração de achados.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse" role="table">
          <thead>
            <tr>
              <th className="w-24" scope="col" />
              {PROBABILIDADES.map((p) => (
                <th key={p} scope="col" className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-texto-2 text-center">
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matriz.map((linha, i) => (
              <tr key={i}>
                <th scope="row" className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-texto-2 text-right pr-4">
                  {linha[0].severidade}
                </th>
                {linha.map((celula, j) => {
                  const qtd = celula.achados.length;
                  const temAchados = qtd > 0;
                  const prob = celula.probabilidade;
                  const sev = celula.severidade;

                  return (
                    <td
                      key={j}
                      className={`relative px-2 py-3 border border-borda/50 transition-colors duration-200 ${
                        temAchados
                          ? `${corProbabilidade(prob)} ${corSeveridade(sev)}`
                          : "bg-superficie/50 hover:bg-borda/30"
                      }`}
                    >
                      {temAchados && (
                        <>
                          <span className="block font-mono text-xl font-bold text-center text-accent">
                            {qtd}
                          </span>
                          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-0.5">
                            {celula.achados.slice(0, 3).map((a) => (
                              <span
                                key={a.id}
                                className="rounded-sm border border-accent/30 bg-accent/10 px-1 py-0.5 font-mono text-[8px] text-accent"
                              >
                                {a.id}
                              </span>
                            ))}
                            {celula.achados.length > 3 && (
                              <span className="rounded-sm border border-borda/30 bg-borda/10 px-1 py-0.5 font-mono text-[8px] text-texto-2">
                                +{celula.achados.length - 3}
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-texto-2">
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-sm border border-critica/40 bg-critica/20" />
          <span>Probabilidade Alta / Impacto Crítico</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-sm border border-alta/40 bg-alta/20" />
          <span>Probabilidade Média / Impacto Alto</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-sm border border-media/40 bg-media/20" />
          <span>Probabilidade Baixa / Impacto Médio</span>
        </div>
      </div>
    </div>
  );
}
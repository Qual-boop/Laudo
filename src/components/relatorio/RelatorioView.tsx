import { RelatorioAchado } from "@/components/relatorio/RelatorioAchado";
import { RelatorioCapa } from "@/components/relatorio/RelatorioCapa";
import {
  RelatorioConclusao,
  RelatorioRecomendacoes,
} from "@/components/relatorio/RelatorioRecomendacoes";
import { RelatorioEscopo } from "@/components/relatorio/RelatorioEscopo";
import { RelatorioSumario } from "@/components/relatorio/RelatorioSumario";
import { ResumoVisual } from "@/components/relatorio/ResumoVisual";
import { MatrizRisco } from "@/components/relatorio/MatrizRisco";
import { TimelineAchados } from "@/components/relatorio/TimelineAchados";
import { Secao } from "@/components/relatorio/Secao";
import type { Relatorio as DadosRelatorio } from "@/lib/tipos";

export function RelatorioView({ relatorio }: { relatorio: DadosRelatorio }) {
  const { capa, sumarioExecutivo, escopoMetodologia, achados, recomendacoesGerais, conclusao } = relatorio;

  return (
    <article className="flex flex-col gap-10">
      <div className="print-cabecalho border-b border-borda pb-1.5 text-[9px] tracking-wide text-texto-2/70">
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-semibold uppercase tracking-widest">
            {capa.cliente}
          </span>
          <span>{capa.titulo}</span>
          <span>{capa.data}</span>
        </div>
      </div>

      <div className="print-rodape border-t border-borda pt-1.5 text-[9px] tracking-wide text-texto-2/70">
        <div className="flex items-baseline justify-between gap-4">
          <span>
            {capa.classificacao} · v{capa.versao}
          </span>
          <span>Gerado por Laudo — laudo.app</span>
        </div>
      </div>

      <RelatorioCapa capa={capa} />

      <div className="flex flex-col gap-10">
        <ResumoVisual sumario={sumarioExecutivo} />

        <Secao numero="01" titulo="Sumário Executivo">
          <RelatorioSumario sumario={sumarioExecutivo} />
        </Secao>

        <Secao numero="02" titulo="Matriz de Risco" quebra>
          <MatrizRisco achados={achados} />
        </Secao>

        <Secao numero="03" titulo="Escopo e Metodologia">
          <RelatorioEscopo escopo={escopoMetodologia} />
        </Secao>

        <Secao numero="04" titulo="Timeline" quebra>
          <TimelineAchados achados={achados} />
        </Secao>

        <Secao numero="05" titulo="Achados" quebra>
          <div className="flex flex-col gap-5">
            {achados.map((achado) => (
              <RelatorioAchado key={achado.id} achado={achado} />
            ))}
          </div>
        </Secao>

        <RelatorioRecomendacoes recomendacoes={recomendacoesGerais} />
        <RelatorioConclusao relatorio={relatorio} />
      </div>
    </article>
  );
}

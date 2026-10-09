import { RelatorioAchado } from "@/components/relatorio/RelatorioAchado";
import { RelatorioCapa } from "@/components/relatorio/RelatorioCapa";
import {
  RelatorioConclusao,
  RelatorioRecomendacoes,
} from "@/components/relatorio/RelatorioRecomendacoes";
import { RelatorioEscopo } from "@/components/relatorio/RelatorioEscopo";
import { RelatorioSumario } from "@/components/relatorio/RelatorioSumario";
import { Secao } from "@/components/relatorio/Secao";
import type { Relatorio as DadosRelatorio } from "@/lib/tipos";

export function RelatorioView({ relatorio }: { relatorio: DadosRelatorio }) {
  const { capa, sumarioExecutivo, escopoMetodologia, achados } = relatorio;

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
        <RelatorioSumario sumario={sumarioExecutivo} />
        <RelatorioEscopo escopo={escopoMetodologia} />

        <Secao numero="03" titulo="Achados" quebra>
          <div className="flex flex-col gap-5">
            {achados.map((achado) => (
              <RelatorioAchado key={achado.id} achado={achado} />
            ))}
          </div>
        </Secao>

        <RelatorioRecomendacoes recomendacoes={relatorio.recomendacoesGerais} />
        <RelatorioConclusao relatorio={relatorio} />
      </div>
    </article>
  );
}

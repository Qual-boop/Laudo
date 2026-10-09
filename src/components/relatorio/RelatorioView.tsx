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
      <div className="print-rodape border-t border-borda pt-2 font-mono text-[9px] tracking-wide text-texto-2/70">
        {capa.cliente} · {capa.titulo} · v{capa.versao} · {capa.classificacao}
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

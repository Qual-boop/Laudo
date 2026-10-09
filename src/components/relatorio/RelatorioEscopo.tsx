import { Campo, Secao } from "@/components/relatorio/Secao";
import type { EscopoMetodologia as DadosEscopo } from "@/lib/tipos";

export function RelatorioEscopo({
  escopo,
}: {
  escopo: DadosEscopo;
}) {
  const semInformacao = (v: string) => !v || v.trim().length === 0;

  return (
    <Secao numero="02" titulo="Escopo e Metodologia" quebra>
      <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Campo rotulo="escopo testado" className="sm:col-span-2">
          {semInformacao(escopo.escopo) ? (
            <span className="text-texto-2">Não informado</span>
          ) : (
            escopo.escopo
          )}
        </Campo>

        <Campo rotulo="metodologia">
          {semInformacao(escopo.metodologia) ? (
            <span className="text-texto-2">Não informada</span>
          ) : (
            escopo.metodologia
          )}
        </Campo>

        <Campo rotulo="período do teste">
          {semInformacao(escopo.periodo) ? (
            <span className="text-texto-2">Não informado</span>
          ) : (
            <span className="font-mono text-xs">{escopo.periodo}</span>
          )}
        </Campo>

        <Campo rotulo="ferramentas utilizadas" className="sm:col-span-2">
          {escopo.ferramentas.length === 0 ? (
            <span className="text-texto-2">Não informadas</span>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {escopo.ferramentas.map((f) => (
                <li
                  key={f}
                  className="rounded-sm border border-borda bg-superficie-2 px-2 py-0.5 font-mono text-[11px] text-texto-2"
                >
                  {f}
                </li>
              ))}
            </ul>
          )}
        </Campo>

        <Campo rotulo="limitações" className="sm:col-span-2">
          {semInformacao(escopo.limitacoes) ? (
            <span className="text-texto-2">Não informadas</span>
          ) : (
            escopo.limitacoes
          )}
        </Campo>
      </dl>
    </Secao>
  );
}

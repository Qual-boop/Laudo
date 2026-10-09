import type { Capa as DadosCapa } from "@/lib/tipos";

export function RelatorioCapa({ capa }: { capa: DadosCapa }) {
  return (
    <div className="print-capa flex flex-col justify-between rounded-md border border-borda bg-superficie p-8 sm:p-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-accent">
            laudo · relatório de teste de intrusão
          </p>
          <div className="mt-1.5 h-px w-16 bg-accent" />
        </div>
        <span className="rounded-sm border border-alta/40 bg-alta/10 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-alta">
          {capa.classificacao}
        </span>
      </div>

      <div className="my-10">
        <h1 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight text-texto sm:text-4xl">
          {capa.titulo}
        </h1>
      </div>

      <dl className="grid grid-cols-2 gap-x-8 gap-y-5 border-t border-borda pt-6 sm:grid-cols-4">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
            cliente
          </dt>
          <dd className="mt-1 truncate text-sm font-medium text-texto">{capa.cliente}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
            data
          </dt>
          <dd className="mt-1 font-mono text-sm text-texto">{capa.data}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
            versão
          </dt>
          <dd className="mt-1 font-mono text-sm text-texto">{capa.versao}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
            classificação
          </dt>
          <dd className="mt-1 text-sm text-texto">{capa.classificacao}</dd>
        </div>
      </dl>
    </div>
  );
}

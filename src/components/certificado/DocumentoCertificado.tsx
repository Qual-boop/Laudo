import type { ReactNode } from "react";
import type { Certificado } from "@/lib/certificado-dados";
import { formatarHash } from "@/lib/certificado";
import { SeverityBadge } from "@/components/SeverityBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { ROTULO_RESULTADO } from "@/lib/verificacao";

type Props = {
  certificado: Certificado;
  /** Botões do cabeçalho (some na impressão). */
  acoes: ReactNode;
  /** Bloco extra abaixo do hash (ex.: como recalcular, no link público). */
  children?: ReactNode;
};

/**
 * Certificado emitido — documento imprimível, tudo numa página. Usado pela
 * página do dono (/certificado/[id]) e pelo link público (/c/[token]).
 */
export function DocumentoCertificado({ certificado, acoes, children }: Props) {
  const { dados, progresso, hash } = certificado;

  return (
    <article className="print-detalhe overflow-hidden rounded-md border border-accent/40 bg-superficie">
      <header className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-accent/30 bg-superficie-2 px-5 py-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-accent">
          certificado #{dados.relatorio.id} · emitido em {dados.emitidoEm}
        </span>
        {acoes}
      </header>

      <div className="flex flex-col gap-8 p-6 sm:p-10">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-accent">
              laudo · certificado de correção
            </p>
            <div className="mt-1.5 h-px w-16 bg-accent" />
            <h1 className="mt-5 max-w-2xl text-2xl font-bold leading-tight tracking-tight text-texto sm:text-3xl">
              {dados.relatorio.titulo}
            </h1>
            <p className="mt-2 text-sm text-texto-2">
              Relatório de teste de intrusão · v{dados.relatorio.versao} ·{" "}
              {dados.relatorio.data}
            </p>
          </div>

          <div className="rounded-md border border-accent/40 bg-accent/10 px-5 py-4 text-center">
            <span aria-hidden="true" className="font-mono text-2xl text-accent">
              ✓
            </span>
            <p className="font-mono text-2xl font-bold text-accent">100%</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-accent/80">
              verificado
            </p>
          </div>
        </div>

        <p className="max-w-3xl text-sm leading-relaxed text-texto">
          Certificamos que os{" "}
          <strong className="font-semibold text-accent">
            {progresso.total} achado{progresso.total === 1 ? "" : "s"}
          </strong>{" "}
          de segurança do relatório acima, do cliente{" "}
          <strong className="font-semibold">{dados.relatorio.cliente}</strong>,
          foram submetidos a reteste e confirmados como corrigidos.
        </p>

        <dl className="grid grid-cols-2 gap-x-8 gap-y-5 border-t border-borda pt-6 sm:grid-cols-4">
          <Dado rotulo="cliente" valor={dados.relatorio.cliente} />
          <Dado rotulo="relatório" valor={`#${dados.relatorio.id}`} />
          <Dado rotulo="emitido em" valor={dados.emitidoEm} mono />
          <Dado
            rotulo="achados corrigidos"
            valor={`${progresso.verificados}/${progresso.total}`}
            mono
          />
        </dl>

        <section>
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
            achados corrigidos
          </h2>
          <ul className="mt-3 flex flex-col divide-y divide-borda rounded-md border border-borda">
            {dados.achados.map((achado) => (
              <li
                key={achado.ref}
                className="print-detalhe flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
              >
                <span className="font-mono text-[10px] tracking-wider text-texto-2">
                  {achado.ref}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-texto">
                  {achado.titulo}
                </span>
                <SeverityBadge severidade={achado.severidade} />
                <span className="font-mono text-[11px] text-texto-2">
                  reteste {achado.dataReteste} ·{" "}
                  {achado.resultado ? ROTULO_RESULTADO[achado.resultado] : "corrigido"}
                </span>
                <StatusBadge status={achado.status} />
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-md border border-borda bg-superficie-2 p-4">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
            hash de verificação · sha-256
          </h2>
          <p className="mt-2 font-mono text-sm break-all text-accent">
            {formatarHash(hash)}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-texto-2">
            O hash cobre relatório, achados, datas de reteste e a data de emissão.
            Recalcular sobre os mesmos dados deve devolver exatamente este valor.
          </p>
          {children}
        </section>

        <footer className="flex flex-wrap items-end justify-between gap-6 border-t border-borda pt-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
              emitido por
            </p>
            <p className="mt-1 text-sm font-medium text-texto">Provafix</p>
            <p className="font-mono text-[11px] text-texto-2">
              assurance de pentest · v0.2
            </p>
          </div>
          <p className="max-w-sm text-right text-xs leading-relaxed text-texto-2">
            Documento gerado a partir dos retestes registrados na plataforma. A
            autenticidade se confere pelo hash acima.
          </p>
        </footer>
      </div>
    </article>
  );
}

function Dado({ rotulo, valor, mono }: { rotulo: string; valor: string; mono?: boolean }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
        {rotulo}
      </dt>
      <dd
        className={`mt-1 truncate text-sm font-medium text-texto ${mono ? "font-mono" : ""}`}
      >
        {valor}
      </dd>
    </div>
  );
}

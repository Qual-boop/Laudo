import { Card } from "@/components/Card";
import { SeverityBadge } from "@/components/SeverityBadge";
import { CvssBadge } from "@/components/relatorio/SeloCvss";
import { ROTULO_CONFIANCA } from "@/lib/verificacao";
import type { Achado as DadosAchado } from "@/lib/tipos";

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="print-detalhe">
      <h4 className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
        {titulo}
      </h4>
      <div className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-texto/90">
        {children}
      </div>
    </div>
  );
}

function Vazio({ children }: { children: React.ReactNode }) {
  return <span className="text-texto-2 italic">{children}</span>;
}

/** Barra lateral colorida por severidade — leitura rápida no relatório e no PDF. */
const BARRAS: Record<string, string> = {
  Critica: "bg-critica",
  Alta: "bg-alta",
  Media: "bg-media",
  Baixa: "bg-baixa",
};

export function RelatorioAchado({ achado }: { achado: DadosAchado }) {
  const temPassos = achado.passosReproducao.length > 0;
  const barra = BARRAS[achado.severidade] ?? "bg-borda";

  return (
    <article className="print-achado relative overflow-hidden rounded-md border border-borda bg-superficie pl-5">
      <span
        aria-hidden="true"
        className={`print-barra-severidade absolute inset-y-0 left-0 w-[3px] ${barra}`}
      />
      <header className="border-b border-borda px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="rounded-sm border border-accent/30 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wider text-accent">
            {achado.id}
          </span>
          <SeverityBadge severidade={achado.severidade} />
        </div>

        <h3 className="mt-3 text-base font-semibold leading-snug tracking-tight text-texto">
          {achado.titulo}
        </h3>

        <dl className="mt-4 flex flex-col gap-2">
          <CvssBadge score={achado.cvss.score} vetor={achado.cvss.vetor} />
          <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-texto-2">
            <span>
              <span className="uppercase tracking-widest opacity-60">cwe: </span>
              {achado.cwe || "—"}
            </span>
            <span>
              <span className="uppercase tracking-widest opacity-60">owasp: </span>
              {achado.owasp || "—"}
            </span>
            <span>
              <span className="uppercase tracking-widest opacity-60">confiança: </span>
              {ROTULO_CONFIANCA[achado.confianca] ?? achado.confianca}
            </span>
            {achado.dataRetesteSugerida && (
              <span>
                <span className="uppercase tracking-widest opacity-60">
                  reteste sugerido:{" "}
                </span>
                {achado.dataRetesteSugerida}
              </span>
            )}
          </div>
        </dl>
      </header>

      <div className="flex flex-col gap-5 px-5 py-5 sm:px-6">
        <Bloco titulo="descrição técnica">
          {achado.descricaoTecnica || <Vazio>Não informada</Vazio>}
        </Bloco>

        <Bloco titulo="impacto no negócio">
          {achado.impactoNegocio || <Vazio>Não avaliado</Vazio>}
        </Bloco>

        <Bloco titulo="evidências">
          {achado.evidencias ? (
            <pre className="overflow-x-auto rounded-md border border-borda bg-fundo p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-texto/80">
              {achado.evidencias}
            </pre>
          ) : (
            <Vazio>Não fornecidas</Vazio>
          )}
        </Bloco>

        {temPassos && (
          <div className="print-detalhe">
            <h4 className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
              passos de reprodução
            </h4>
            <ol className="mt-2 flex flex-col gap-1.5">
              {achado.passosReproducao.map((passo, i) => (
                <li key={i} className="flex gap-3 text-sm leading-relaxed text-texto/90">
                  <span className="shrink-0 font-mono text-xs text-accent tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{passo}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="print-detalhe grid grid-cols-1 gap-5 rounded-md border border-borda bg-superficie-2 p-4 sm:grid-cols-2">
          <Bloco titulo="remediação · curto prazo">
            {achado.remediacao.curtoPrazo || <Vazio>Não definida</Vazio>}
          </Bloco>
          <Bloco titulo="remediação · longo prazo">
            {achado.remediacao.longoPrazo || <Vazio>Não definida</Vazio>}
          </Bloco>

          {achado.remediacao.referencias.length > 0 && (
            <div className="sm:col-span-2">
              <h4 className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
                referências
              </h4>
              <ul className="mt-2 flex flex-col gap-1">
                {achado.remediacao.referencias.map((ref, i) => (
                  <li key={i} className="font-mono text-[11px] text-texto-2">
                    ↳ {ref}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

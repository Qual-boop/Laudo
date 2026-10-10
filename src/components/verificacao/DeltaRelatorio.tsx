import { Card } from "@/components/Card";
import { SeverityBadge } from "@/components/SeverityBadge";
import { StatusBadge } from "@/components/verificacao/PainelBase";
import { Button } from "@/components/Button";
import { ROTULO_CONFIANCA } from "@/lib/verificacao";
import type { DeltaRelatorio as DadosDelta } from "@/lib/tipos";

type Props = {
  delta: DadosDelta;
  onFechar?: () => void;
};

function dataCurta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const p = iso.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}

/**
 * Relatório de delta: o que mudou entre o achado original e o reteste.
 * Determinístico — não usa IA, porque os dados já existem.
 */
export function DeltaRelatorio({ delta, onFechar }: Props) {
  const { achado, reteste } = delta;

  return (
    <Card className="border-accent/40">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-borda px-5 py-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-accent">
            relatório de delta
          </p>
          <h3 className="mt-1 text-sm font-semibold tracking-tight text-texto">
            Verificação de correção
          </h3>
        </div>
        {onFechar && (
          <Button variante="fantasma" tamanho="sm" onClick={onFechar}>
            fechar
          </Button>
        )}
      </header>

      <div className="flex flex-col gap-4 px-5 py-4">
        <section>
          <h4 className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
            achado original
          </h4>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] tracking-wider text-texto-2">
              {achado.achadoRef}
            </span>
            <SeverityBadge severidade={achado.severidade} />
          </div>
          <p className="mt-2 text-sm font-medium leading-relaxed text-texto">
            {achado.titulo}
          </p>
          <p className="mt-1 font-mono text-[11px] text-texto-2">
            cliente {achado.cliente} · confiança{" "}
            {ROTULO_CONFIANCA[achado.confianca]} · achado em{" "}
            {dataCurta(achado.dataOriginal)}
          </p>
        </section>

        <section className="border-t border-borda pt-4">
          <h4 className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
            resultado do reteste
          </h4>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={delta.statusFinal} />
            <span className="text-sm text-texto">{reteste.rotulo}</span>
            <span className="font-mono text-[11px] text-texto-2">
              em {dataCurta(reteste.data)}
            </span>
          </div>
          {reteste.evidencia ? (
            <pre className="mt-3 overflow-x-auto rounded-sm border border-borda bg-fundo p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-texto/80">
              {reteste.evidencia}
            </pre>
          ) : (
            <p className="mt-2 text-sm text-texto-2">Sem evidência registrada.</p>
          )}
        </section>

        <section className="border-t border-borda pt-4">
          <h4 className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
            status final
          </h4>
          <p className="mt-2 text-sm font-semibold text-texto">
            {delta.statusFinalRotulo}
          </p>
        </section>
      </div>
    </Card>
  );
}

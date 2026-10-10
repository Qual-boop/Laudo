import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { SeverityBadge } from "@/components/SeverityBadge";
import { StatusBadge } from "@/components/verificacao/PainelBase";
import { DeltaRelatorio } from "@/components/verificacao/DeltaRelatorio";
import {
  ESTILO_STATUS,
  ROTULO_RESULTADO,
} from "@/lib/verificacao";
import type { AchadoVerificavel } from "@/lib/tipos";

type Props = {
  achado: AchadoVerificavel;
  onRegistrar: (achado: AchadoVerificavel) => void;
  onVerDelta: (achado: AchadoVerificavel) => void;
};

function dataCurta(iso: string | null): string | null {
  if (!iso) return null;
  const partes = iso.split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : iso;
}

export function AchadoVerificacaoCard({ achado, onRegistrar, onVerDelta }: Props) {
  const reteste = achado.ultimo_reteste;

  return (
    <article className="rounded-md border border-borda bg-superficie">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-borda px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] tracking-wider text-accent">
              {achado.achado_ref}
            </span>
            <SeverityBadge severidade={achado.severidade} />
            <StatusBadge status={achado.status} />
          </div>
          <h3 className="mt-2 text-sm font-semibold leading-snug text-texto">
            {achado.titulo}
          </h3>
          <p className="mt-1 font-mono text-[11px] text-texto-2">
            {achado.cliente}
            {achado.cwe ? ` · ${achado.cwe}` : ""}
            {achado.data_reteste_sugerida
              ? ` · reteste sugerido ${dataCurta(achado.data_reteste_sugerida)}`
              : ""}
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {reteste && (
            <Button variante="fantasma" tamanho="sm" onClick={() => onVerDelta(achado)}>
              relatório de delta
            </Button>
          )}
          <Button variante="primaria" tamanho="sm" onClick={() => onRegistrar(achado)}>
            {reteste ? "registrar novo reteste" : "registrar reteste"}
          </Button>
        </div>
      </div>

      {reteste ? (
        <div className="px-5 py-4">
          <dl className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px]">
            <div className="flex gap-2">
              <dt className="text-texto-2">resultado:</dt>
              <dd className="text-texto">{ROTULO_RESULTADO[reteste.resultado]}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-texto-2">data:</dt>
              <dd className="text-texto">{dataCurta(reteste.data_reteste)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-texto-2">evidências:</dt>
              <dd className="text-texto">
                {achado.total_retestes} registro{achado.total_retestes === 1 ? "" : "s"}
              </dd>
            </div>
          </dl>
          {reteste.evidencia && (
            <pre className="mt-3 overflow-x-auto rounded-sm border border-borda bg-fundo p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-texto/80">
              {reteste.evidencia}
            </pre>
          )}
        </div>
      ) : (
        <p className="px-5 py-4 text-sm text-texto-2">
          Aguardando reteste. Registre o resultado para confirmar ou refutar a
          correção.
        </p>
      )}
    </article>
  );
}

export { ESTILO_STATUS };
export type { DeltaRelatorio };

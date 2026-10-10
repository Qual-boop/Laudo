import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { SeverityBadge } from "@/components/SeverityBadge";
import {
  ESTILO_STATUS,
  ROTULO_STATUS,
} from "@/lib/verificacao";
import type { AchadoVerificavel, StatusVerificacao } from "@/lib/tipos";

export function StatusBadge({ status }: { status: StatusVerificacao }) {
  return (
    <Badge className={ESTILO_STATUS[status]}>{ROTULO_STATUS[status]}</Badge>
  );
}

export function BarraProgresso({
  verificados,
  total,
}: {
  verificados: number;
  total: number;
}) {
  const pct = total === 0 ? 0 : Math.round((verificados / total) * 100);

  return (
    <Card className="px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-texto">
          {verificados} de {total} achados verificados
        </span>
        <span className="font-mono text-xs text-texto-2">{pct}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={verificados}
        aria-valuemin={0}
        aria-valuemax={total}
        className="mt-3 h-1.5 overflow-hidden rounded-sm bg-borda"
      >
        <div
          className="h-full bg-accent transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </Card>
  );
}

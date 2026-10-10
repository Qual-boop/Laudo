import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";

/* ---------------------------------------------------------------
   Barra de progresso da verificação.
   A cor carrega o significado: verde só quando tudo fechou.
   --------------------------------------------------------------- */

export function corDaProgresso(pct: number): string {
  if (pct >= 100) return "bg-accent";
  if (pct >= 50) return "bg-media";
  return "bg-critica";
}

export function rotuloDaProgresso(pct: number): string {
  if (pct >= 100) return "text-accent";
  if (pct >= 50) return "text-media";
  return "text-critica";
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
    <Card className="px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-texto">
          {verificados} de {total} achados verificados{" "}
          <span className={`font-mono text-xs ${rotuloDaProgresso(pct)}`}>
            ({pct}%)
          </span>
        </span>
        {pct >= 100 && <Badge tom="accent">completo</Badge>}
      </div>

      <div
        role="progressbar"
        aria-valuenow={verificados}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Progresso da verificação de correções"
        className="mt-3 h-2 overflow-hidden rounded-sm bg-borda"
      >
        <div
          className={`h-full transition-all duration-500 ${corDaProgresso(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </Card>
  );
}

/** Skeleton genérico para listas. */
export function ListaSkeleton({ linhas = 3 }: { linhas?: number }) {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-3"
      role="status"
      aria-label="Carregando"
    >
      {Array.from({ length: linhas }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-md border border-borda bg-superficie p-4"
        >
          <div className="flex items-center gap-2">
            <div className="h-3 w-4 rounded-sm bg-borda" />
            <div className="h-3 w-20 rounded-sm bg-borda" />
            <div className="ml-auto h-3 w-16 rounded-sm bg-borda" />
          </div>
          <div className="mt-3 h-3 w-2/3 rounded-sm bg-borda" />
          <div className="mt-2 h-3 w-full rounded-sm bg-borda/60" />
        </div>
      ))}
    </div>
  );
}

/** Estado vazio com ícone, título, descrição e CTA. */
export function EstadoVazio({
  icone,
  titulo,
  descricao,
  cta,
}: {
  icone: string;
  titulo: string;
  descricao: string;
  cta?: { rotulo: string; href?: string; onClick?: () => void };
}) {
  return (
    <div className="rounded-lg border border-dashed border-borda bg-superficie/60 px-6 py-14 text-center">
      <span aria-hidden="true" className="font-mono text-2xl text-texto-2">
        {icone}
      </span>
      <h3 className="mt-3 text-sm font-semibold text-texto">{titulo}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-texto-2">
        {descricao}
      </p>
      {cta &&
        (cta.href ? (
          <a
            href={cta.href}
            className="interativo mt-5 inline-flex cursor-pointer items-center justify-center rounded-md border border-accent px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-accent hover:bg-accent hover:text-fundo"
          >
            {cta.rotulo}
          </a>
        ) : (
          <button
            type="button"
            onClick={cta.onClick}
            className="interativo mt-5 inline-flex cursor-pointer items-center justify-center rounded-md border border-accent px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-accent hover:bg-accent hover:text-fundo"
          >
            {cta.rotulo}
          </button>
        ))}
    </div>
  );
}

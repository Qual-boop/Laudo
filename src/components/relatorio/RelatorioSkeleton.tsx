import { Card } from "@/components/Card";
import { TerminalBar } from "@/components/TerminalBar";

const ETAPAS = [
  "estruturando capa e escopo...",
  "classificando achados por severidade...",
  "calculando CVSS v3.1...",
  "escrevendo sumário executivo...",
  "gerando passos de reprodução...",
  "montando recomendações...",
];

export function RelatorioSkeleton() {
  return (
    <Card className="mt-8">
      <TerminalBar>laudo@pentest:~$ laudo gerar --formato=relatorio</TerminalBar>
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <p className="font-mono text-xs text-accent">
          gerando relatório completo<span className="animate-blink"> ▋</span>
        </p>

        <ul className="flex flex-col gap-1.5">
          {ETAPAS.map((etapa, i) => (
            <li
              key={etapa}
              className="font-mono text-[11px] text-texto-2/70"
              style={{ animationDelay: `${i * 140}ms` }}
            >
              <span className="text-accent/60">$</span> {etapa}
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2.5 pt-2">
          <div className="h-3 w-full shimmer rounded-sm bg-borda" />
          <div className="h-3 w-11/12 shimmer rounded-sm bg-borda" />
          <div className="h-3 w-4/5 shimmer rounded-sm bg-borda" />
          <div className="mt-4 h-24 w-full shimmer rounded-md bg-borda/60" />
          <div className="h-3 w-2/3 shimmer rounded-sm bg-borda" />
        </div>

        <p className="font-mono text-[11px] text-texto-2/60">
          relatório completo leva mais tempo que um resumo
          <span className="animate-blink"> ▋</span>
        </p>
      </div>
    </Card>
  );
}

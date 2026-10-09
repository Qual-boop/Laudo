export function corCvss(score: number): string {
  if (score >= 9) return "text-critica border-critica/30 bg-critica/10";
  if (score >= 7) return "text-alta border-alta/30 bg-alta/10";
  if (score >= 4) return "text-media border-media/30 bg-media/10";
  return "text-baixa border-baixa/30 bg-baixa/10";
}

export function CvssBadge({ score, vetor }: { score: number; vetor?: string }) {
  return (
    <div className="print-detalhe flex items-center gap-2">
      <span
        className={`inline-flex shrink-0 items-baseline gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${corCvss(score)}`}
        title="Pontuação CVSS v3.1"
      >
        <span className="opacity-70">cvss</span>
        <span className="text-xs font-semibold">{score.toFixed(1)}</span>
      </span>
      {vetor && (
        <span className="truncate font-mono text-[11px] text-texto-2">{vetor}</span>
      )}
    </div>
  );
}

const RISCOS: Record<string, string> = {
  Critico: "border-critica/40 bg-critica/10 text-critica",
  Alto: "border-alta/40 bg-alta/10 text-alta",
  Medio: "border-media/40 bg-media/10 text-media",
  Baixo: "border-baixa/40 bg-baixa/10 text-baixa",
};

export function RiscoGeralBadge({ risco }: { risco: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-xs font-medium uppercase tracking-widest ${
        RISCOS[risco] ?? "border-borda bg-borda/40 text-texto-2"
      }`}
    >
      risco geral: {risco}
    </span>
  );
}

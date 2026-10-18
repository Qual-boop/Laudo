"use client";

export function BotaoImprimir({ rotulo = "imprimir / salvar PDF" }: { rotulo?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print interativo cursor-pointer rounded-md border border-accent px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-accent hover:bg-accent hover:text-fundo"
    >
      {rotulo}
    </button>
  );
}

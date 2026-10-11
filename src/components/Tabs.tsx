export type Aba = "novo" | "verificacao" | "historico";

type Props = {
  ativa: Aba;
  onChange: (aba: Aba) => void;
  contagem?: Partial<Record<Aba, number>>;
};

const ABAS: { id: Aba; rotulo: string; dica: string }[] = [
  { id: "novo", rotulo: "Novo", dica: "gerar relatório" },
  { id: "verificacao", rotulo: "Verificação", dica: "retest e correções" },
  { id: "historico", rotulo: "Histórico", dica: "relatórios salvos" },
];

export function Tabs({ ativa, onChange, contagem }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Seções do painel"
      className="no-print flex flex-col gap-1 rounded-xl border border-borda bg-superficie/60 p-1 backdrop-blur-sm sm:flex-row sm:gap-1"
    >
      {ABAS.map((aba) => {
        const selecionada = ativa === aba.id;
        const n = contagem?.[aba.id];

        return (
          <button
            key={aba.id}
            role="tab"
            type="button"
            aria-selected={selecionada}
            title={aba.dica}
            onClick={() => onChange(aba.id)}
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 font-mono text-[11px] uppercase tracking-wider transition-all duration-200 active:scale-[0.98] ${
              selecionada
                ? "bg-accent/15 text-accent shadow-[inset_0_0_0_1px_var(--color-accent)]"
                : "text-texto-2 hover:bg-superficie-2 hover:text-texto"
            }`}
          >
            {aba.rotulo}
            {typeof n === "number" && (
              <span
                className={`rounded-sm px-1.5 py-0.5 text-[10px] ${
                  selecionada ? "bg-accent/10 text-accent" : "bg-borda/40 text-texto-2"
                }`}
              >
                {n}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

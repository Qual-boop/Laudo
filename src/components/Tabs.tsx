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
      className="no-print flex flex-col gap-1 border-b border-borda sm:flex-row sm:gap-2"
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
            className={`-mb-px flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider transition-colors duration-200 ${
              selecionada
                ? "border-accent text-accent"
                : "border-transparent text-texto-2 hover:border-borda hover:text-texto"
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

import { Logo } from "@/components/Logo";
import { Tabs, type Aba } from "@/components/Tabs";

type Props = {
  aba: Aba;
  onAba: (aba: Aba) => void;
  contagem?: Partial<Record<Aba, number>>;
  pendentes?: number;
};

export function Header({ aba, onAba, contagem, pendentes }: Props) {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-borda bg-fundo/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 sm:px-6">
        <div className="flex items-center gap-3">
          <Logo className="h-8 w-8 shrink-0 text-accent" />
          <span className="text-base font-bold tracking-tight text-texto">
            Laudo
          </span>
        </div>

        <div className="order-3 -mb-3.5 w-full border-b border-borda sm:order-none sm:mb-0 sm:w-auto sm:border-0">
          <Tabs ativa={aba} onChange={onAba} contagem={contagem} />
        </div>

        <div className="ml-auto flex items-center gap-3">
          {typeof pendentes === "number" && pendentes > 0 && (
            <span className="hidden font-mono text-[10px] uppercase tracking-wider text-media sm:inline">
              {pendentes} pendente{pendentes === 1 ? "" : "s"}
            </span>
          )}
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-texto-2">
            <span className="animate-ping-suave h-1.5 w-1.5 rounded-full bg-accent" />
            online
          </span>
        </div>
      </div>
    </header>
  );
}

type TerminalBarProps = {
  children?: string;
  aoVivo?: boolean;
};

export function TerminalBar({ children = "laudo@pentest:~$", aoVivo = false }: TerminalBarProps) {
  return (
    <div className="flex items-center gap-3 border-b border-borda bg-superficie-2 px-4 py-2.5">
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
      </div>
      <span className="truncate font-mono text-[11px] tracking-wide text-texto-2">
        {children}
      </span>
      {aoVivo && (
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          live
        </span>
      )}
    </div>
  );
}

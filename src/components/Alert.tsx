import type { ReactNode } from "react";

type AlertProps = {
  children: ReactNode;
  tom: "erro" | "sucesso";
};

const ESTILOS = {
  erro: {
    container: "border-critica/40 bg-critica/10 text-critica",
    icone: "[ERROR]",
  },
  sucesso: {
    container: "border-accent/40 bg-accent/10 text-accent",
    icone: "[OK]",
  },
} as const;

export function Alert({ children, tom }: AlertProps) {
  const estilo = ESTILOS[tom];

  return (
    <div
      role="alert"
      className={`no-print flex items-start gap-3 rounded-md border px-4 py-3 font-mono text-xs leading-relaxed ${estilo.container}`}
    >
      <span className="shrink-0 font-medium tracking-wider">{estilo.icone}</span>
      <p className="text-texto">{children}</p>
    </div>
  );
}

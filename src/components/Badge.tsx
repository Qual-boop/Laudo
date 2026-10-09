import type { ReactNode } from "react";

export type Tom = "slate" | "accent" | "ciano" | "violeta" | "media" | "baixa" | "critica";

const TONS: Record<Tom, string> = {
  slate: "border-borda bg-borda/40 text-texto-2",
  accent: "border-accent/30 bg-accent/10 text-accent",
  ciano: "border-ciano/30 bg-ciano/10 text-ciano",
  violeta: "border-violeta/30 bg-violeta/10 text-violeta",
  media: "border-media/30 bg-media/10 text-media",
  baixa: "border-baixa/30 bg-baixa/10 text-baixa",
  critica: "border-critica/30 bg-critica/10 text-critica",
};

type BadgeProps = {
  children: ReactNode;
  tom?: Tom;
  className?: string;
};

export function Badge({ children, tom = "slate", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${TONS[tom]} ${className}`}
    >
      {children}
    </span>
  );
}

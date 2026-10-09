import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: CardProps) {
  return (
    <div className={`print-card rounded-md border border-borda bg-superficie ${className}`}>
      {children}
    </div>
  );
}

type CardHeaderProps = {
  children: ReactNode;
  className?: string;
};

export function CardHeader({ children, className = "" }: CardHeaderProps) {
  return (
    <div className={`border-b border-borda px-5 py-4 ${className}`}>{children}</div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-sm font-semibold tracking-tight text-texto">{children}</h2>
  );
}

export function CardDescription({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-xs text-texto-2">{children}</p>;
}

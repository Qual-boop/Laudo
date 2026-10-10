import type { ButtonHTMLAttributes } from "react";

export type Variante = "primaria" | "secundaria" | "sucesso" | "fantasma";
export type Tamanho = "sm" | "md" | "lg";

const VARIANTES: Record<Variante, string> = {
  primaria: "border-accent bg-transparent text-accent hover:bg-accent hover:text-fundo",
  secundaria:
    "border-borda bg-transparent text-texto-2 hover:border-accent hover:bg-accent hover:text-fundo",
  sucesso: "border-accent bg-accent text-fundo hover:bg-transparent hover:text-accent",
  fantasma:
    "border-transparent bg-transparent text-texto-2 hover:border-borda hover:text-accent",
};

const TAMANHOS: Record<Tamanho, string> = {
  sm: "px-3 py-1.5 text-[10px] gap-1.5",
  md: "px-4 py-2 text-[11px] gap-2",
  lg: "w-full px-5 py-3 text-xs gap-2 sm:w-auto",
};

const BASE =
  "interativo inline-flex cursor-pointer items-center justify-center rounded-md border font-mono font-medium uppercase tracking-wider " +
  "transition-colors duration-200 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-fundo " +
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  tamanho?: Tamanho;
  ariaLabel?: string;
};

export function Button({
  variante = "primaria",
  tamanho = "md",
  className = "",
  type = "button",
  ariaLabel,
  ...props
}: ButtonProps) {
  const ariaAttr = ariaLabel ? { "aria-label": ariaLabel } : {};

  return (
    <button
      type={type}
      className={`${BASE} ${VARIANTES[variante]} ${TAMANHOS[tamanho]} ${className}`}
      {...ariaAttr}
      {...props}
    />
  );
}

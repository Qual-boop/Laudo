import type { ReactNode } from "react";

/** Ícones de traço da landing (24×24, herdam a cor do texto). */
export type NomeIcone =
  | "documento"
  | "alvo"
  | "radar"
  | "delta"
  | "exportar"
  | "camadas"
  | "cadeado"
  | "hash"
  | "check"
  | "usuario"
  | "equipe"
  | "codigo"
  | "seta";

const TRACOS: Record<NomeIcone, ReactNode> = {
  documento: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </>
  ),
  alvo: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </>
  ),
  radar: (
    <>
      <path d="M12 3a9 9 0 1 0 9 9" />
      <path d="M12 7a5 5 0 1 0 5 5" />
      <path d="M12 12l7-7" />
    </>
  ),
  delta: <path d="M7 7h11l-3-3M17 17H6l3 3" />,
  exportar: (
    <>
      <path d="M12 3v12M7 8l5-5 5 5" />
      <path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
    </>
  ),
  camadas: (
    <>
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  cadeado: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  hash: <path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  usuario: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  equipe: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" />
    </>
  ),
  codigo: <path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" />,
  seta: <path d="M5 12h14M13 6l6 6-6 6" />,
};

export function Icone({ nome, className = "h-5 w-5" }: { nome: NomeIcone; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {TRACOS[nome]}
    </svg>
  );
}

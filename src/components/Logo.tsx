/**
 * Logo do Provafix — monograma "P✓".
 * Um traço só: a haste e a barriga do P seguem direto para um check, sem
 * levantar a caneta. Prova (P) + fix (✓) na mesma forma, sobre um bloco
 * de cantos suaves. O bloco usa `currentColor` (verde da marca via
 * `text-accent`) e o traço sai no fundo da página, em negativo.
 * Legível de 16 px (favicon) a tamanho de cartaz.
 */
export const LOGO_TRACO = "M16.5 35.5 V12.5 H25 A7.25 7.25 0 0 1 25 27 H22 L27 32 L38.5 18.5";

export function Logo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="Provafix"
      className={`transition-transform duration-300 hover:-rotate-6 hover:scale-105 ${className}`}
    >
      <rect x="3" y="3" width="42" height="42" rx="13" fill="currentColor" />
      <path
        d={LOGO_TRACO}
        stroke="var(--color-fundo, #0a0e14)"
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

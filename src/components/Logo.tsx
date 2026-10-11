/**
 * Logo oficial do Laudo — "O loop que conclui" (vencedora da Fase 1).
 * Um anel quase fechado (o ciclo do pentest) com uma abertura no canto
 * superior direito, por onde escapa o braço longo do checkmark: o ciclo
 * só se completa com a prova da correção.
 */
export function Logo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="Laudo"
      className={`transition-transform duration-300 hover:rotate-[10deg] ${className}`}
    >
      {/* anel com abertura entre -55° e -15° (canto superior direito) */}
      <path
        d="M37.5 20.4 A14 14 0 1 1 32 12.5"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      {/* check cujo braço longo escapa pela abertura do anel */}
      <path
        d="M19 27.5 L26 34 L38 18"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

import type { ReactNode } from "react";

export function Logo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 44"
      fill="none"
      role="img"
      aria-label="Laudo"
      className={className}
    >
      <path
        d="M20 2.5 37 9v12.9c0 10.4-7 18.1-17 21.1C10 40 3 32.3 3 21.9V9L20 2.5Z"
        fill="currentColor"
        fillOpacity="0.1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <polyline
        points="12,17.2 16.6,21.8 12,26.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="21.5"
        y1="26.4"
        x2="29.5"
        y2="26.4"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

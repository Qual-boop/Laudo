export function Spinner({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 animate-spin rounded-full border border-current border-t-transparent ${className}`}
    />
  );
}

export function Cursor({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`animate-blink text-accent ${className}`}>
      ▋
    </span>
  );
}

export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Carregando página"
      className="mx-auto flex h-[50vh] max-w-4xl flex-col items-center justify-center gap-4 px-4"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-borda border-t-accent" />
        <p className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
          carregando...
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-md">
        <div className="h-4 w-3/4 animate-pulse rounded-sm bg-borda" />
        <div className="h-4 w-1/2 animate-pulse rounded-sm bg-borda/60" />
        <div className="h-4 w-2/3 animate-pulse rounded-sm bg-borda/50" />
        <div className="h-4 w-full animate-pulse rounded-sm bg-borda/40" />
      </div>
    </div>
  );
}
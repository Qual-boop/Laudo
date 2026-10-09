import type { ReactNode } from "react";

type SecaoProps = {
  numero: string;
  titulo: string;
  children: ReactNode;
  quebra?: boolean;
};

export function Secao({ numero, titulo, children, quebra }: SecaoProps) {
  return (
    <section className={quebra ? "print-quebra" : undefined}>
      <header className="print-detalhe mb-6">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-medium text-accent">{numero}</span>
          <h2 className="text-lg font-semibold tracking-tight text-texto">{titulo}</h2>
          <span className="h-px flex-1 bg-borda" />
        </div>
      </header>
      {children}
    </section>
  );
}

export function Campo({
  rotulo,
  children,
  className = "",
}: {
  rotulo: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`print-detalhe ${className}`}>
      <dt className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
        {rotulo}
      </dt>
      <dd className="mt-1.5 text-sm leading-relaxed text-texto/90">{children}</dd>
    </div>
  );
}

export function Lista({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col gap-2">{children}</ul>;
}

export function ItemLista({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2.5 text-sm leading-relaxed text-texto/90">
      <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 bg-accent" />
      <span>{children}</span>
    </li>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type TipoToast = "sucesso" | "erro" | "aviso";

export type Toast = {
  id: number;
  tipo: TipoToast;
  texto: string;
};

const ESTILOS: Record<TipoToast, { card: string; icone: string; glifo: string }> = {
  sucesso: {
    card: "border-accent/50 bg-accent/10 text-accent",
    icone: "text-accent",
    glifo: "✓",
  },
  erro: {
    card: "border-critica/50 bg-critica/10 text-critica",
    icone: "text-critica",
    glifo: "✗",
  },
  aviso: {
    card: "border-media/50 bg-media/10 text-media",
    icone: "text-media",
    glifo: "!",
  },
};

const DURACAO_MS = 4000;

/**
 * Toast em vez de <Alert> inline. Autoderruba após 4s e some da lista assim
 * que a animação de saída termina — nunca some no meio da transição.
 */
export function ToastViewport({
  toasts,
  onDisparar,
}: {
  toasts: Toast[];
  onDisparar: (id: number) => void;
}) {
  return (
    <div
      aria-live="polite"
      className="no-print pointer-events-none fixed right-4 top-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`animate-toast-in pointer-events-auto flex items-start gap-2.5 rounded-md border px-4 py-3 shadow-lg backdrop-blur-sm ${ESTILOS[t.tipo].card}`}
        >
          <span
            aria-hidden="true"
            className={`mt-px font-mono text-xs ${ESTILOS[t.tipo].icone}`}
          >
            {ESTILOS[t.tipo].glifo}
          </span>
          <p className="flex-1 text-sm leading-snug">{t.texto}</p>
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => onDisparar(t.id)}
            className={`cursor-pointer font-mono text-xs opacity-60 transition-opacity duration-150 hover:opacity-100 ${ESTILOS[t.tipo].icone}`}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

/** Hook de toasts: useToast() devolve { toasts, sucesso, erro, aviso, remover }. */
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const sequencia = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const remover = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
    setToasts((atuais) => atuais.filter((x) => x.id !== id));
  }, []);

  const disparar = useCallback(
    (tipo: TipoToast, texto: string) => {
      sequencia.current += 1;
      const id = sequencia.current;
      setToasts((atuais) => [...atuais.slice(-2), { id, tipo, texto }]);
      timers.current.set(
        id,
        setTimeout(() => remover(id), DURACAO_MS),
      );
    },
    [remover],
  );

  // Limpa timers pendentes ao desmontar para não vazar setTimeout órfão.
  useEffect(() => {
    const pendentes = timers.current;
    return () => {
      pendentes.forEach(clearTimeout);
      pendentes.clear();
    };
  }, []);

  return {
    toasts,
    remover,
    sucesso: (texto: string) => disparar("sucesso", texto),
    erro: (texto: string) => disparar("erro", texto),
    aviso: (texto: string) => disparar("aviso", texto),
  };
}

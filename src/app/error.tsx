"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/Button";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    console.error("[app/error]", error);
  }, [error]);

  if (!mounted) return null;

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-md border border-critica/40 bg-critica/10 px-6 py-12 text-center">
      <span aria-hidden="true" className="font-mono text-4xl text-critica">
        ⚠
      </span>
      <h1 className="text-lg font-semibold text-texto">Erro no servidor</h1>
      <p className="max-w-md text-sm text-texto-2">
        Ocorreu um erro ao renderizar esta página.
        {error.digest && <span className="font-mono text-xs ml-2">{error.digest}</span>}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variante="primaria" onClick={reset}>
          tentar novamente
        </Button>
        <Button variante="secundaria" onClick={() => window.location.href = "/"}>
          voltar ao início
        </Button>
      </div>
    </div>
  );
}
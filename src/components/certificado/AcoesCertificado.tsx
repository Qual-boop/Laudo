"use client";

import { useState } from "react";
import { Button } from "@/components/Button";

type Props = {
  hash: string;
};

/** Copiar hash e imprimir: as duas únicas ações que precisam de JS no cliente. */
export function AcoesCertificado({ hash }: Props) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(hash);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Clipboard API exige contexto seguro: o hash segue visível na tela
      // para conferência manual.
      setCopiado(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variante="secundaria"
        tamanho="sm"
        onClick={copiar}
        aria-label="Copiar hash de verificação do certificado"
      >
        {copiado ? "copiado ✓" : "copiar hash"}
      </Button>
      <Button
        variante="sucesso"
        tamanho="sm"
        onClick={() => window.print()}
        aria-label="Imprimir ou salvar o certificado em PDF"
      >
        imprimir
      </Button>
    </div>
  );
}

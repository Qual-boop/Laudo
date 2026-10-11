"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import {
  formatarJSON,
  formatarMarkdown,
  formatarTextoSimples,
} from "@/lib/exportacaoAchado";
import { LIMITES, type Plano } from "@/lib/planos";
import type { AchadoVerificavel } from "@/lib/tipos";

type Props = {
  achado: AchadoVerificavel;
  onCopiar: (texto: string, rotulo: string) => void;
  plano?: Plano;
};

const OPCOES = [
  {
    id: "markdown",
    rotulo: "Copiar como Markdown (Jira)",
    formatar: formatarMarkdown,
    aviso: "Achado copiado como Markdown (Jira)",
  },
  {
    id: "json",
    rotulo: "Copiar como JSON (GitHub)",
    formatar: formatarJSON,
    aviso: "Achado copiado como JSON (GitHub)",
  },
  {
    id: "texto",
    rotulo: "Copiar como texto simples",
    formatar: formatarTextoSimples,
    aviso: "Achado copiado como texto simples",
  },
] as const;

/** Botão "Exportar para…" com dropdown nos cards da aba Verificação. */
export function AcoesExportacaoAchado({ achado, onCopiar, plano = "free" }: Props) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const avancado = LIMITES[plano].exportacaoAvancada;

  // Fecha no Escape e no clique fora.
  useEffect(() => {
    if (!aberto) return;
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    function aoClicar(e: MouseEvent) {
      if (caixa.current && !caixa.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("keydown", aoTeclar);
    document.addEventListener("mousedown", aoClicar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.removeEventListener("mousedown", aoClicar);
    };
  }, [aberto]);

  return (
    <div ref={caixa} className="relative">
      <Button
        variante="fantasma"
        tamanho="sm"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={`Exportar achado ${achado.achado_ref} para Jira ou GitHub`}
      >
        exportar para…
      </Button>

      {aberto && (
        <div
          role="menu"
          aria-label="Formatos de exportação"
          className="absolute right-0 z-40 mt-1 w-64 rounded-md border border-borda bg-superficie p-1 shadow-lg"
        >
          {OPCOES.map((op) => {
            const bloqueado = op.id !== "texto" && !avancado;
            return (
              <button
                key={op.id}
                type="button"
                role="menuitem"
                disabled={bloqueado}
                title={bloqueado ? "Disponível nos planos Pro e Team" : undefined}
                onClick={() => {
                  onCopiar(op.formatar(achado), `${op.aviso} — ${achado.achado_ref}`);
                  setAberto(false);
                }}
                className={`interativo block w-full rounded-sm px-3 py-2 text-left font-mono text-[11px] ${
                  bloqueado
                    ? "cursor-not-allowed opacity-40"
                    : "cursor-pointer text-texto-2 hover:bg-superficie-2 hover:text-accent"
                }`}
              >
                {op.rotulo}
                {bloqueado && <span className="ml-2 text-media">🔒 PRO</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { EditorTarja } from "@/components/verificacao/EditorTarja";
import { MAX_EVIDENCIAS_POR_ACHADO, type EvidenciaResumo } from "@/lib/evidencias";

type Props = {
  achadoId: number;
  podeEditar: boolean;
  onAviso: (texto: string) => void;
};

/** Galeria de prints do achado + envio com tarja. Carrega só quando aberta. */
export function EvidenciasAchado({ achadoId, podeEditar, onAviso }: Props) {
  const [lista, setLista] = useState<EvidenciaResumo[] | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/evidencias?achadoId=${achadoId}`);
      if (!res.ok) throw new Error();
      setLista((await res.json()) as EvidenciaResumo[]);
    } catch {
      setLista([]);
      onAviso("Não foi possível carregar as evidências.");
    }
  }, [achadoId, onAviso]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function enviar(imagem: Blob, legenda: string) {
    const form = new FormData();
    form.set("achadoId", String(achadoId));
    form.set("legenda", legenda);
    form.set("arquivo", imagem, imagem.type === "image/jpeg" ? "evidencia.jpg" : "evidencia.png");
    const res = await fetch("/api/v1/evidencias", { method: "POST", body: form });
    const corpo = await res.json().catch(() => null);
    if (!res.ok) throw new Error(corpo?.error ?? "Não foi possível enviar a evidência.");
    setArquivo(null);
    await carregar();
  }

  async function remover(id: number) {
    if (!window.confirm("Remover esta evidência? Não dá para desfazer.")) return;
    const res = await fetch(`/api/v1/evidencias/${id}`, { method: "DELETE" });
    if (!res.ok) onAviso("Não foi possível remover a evidência.");
    await carregar();
  }

  const cheia = (lista?.length ?? 0) >= MAX_EVIDENCIAS_POR_ACHADO;

  return (
    <div className="flex flex-col gap-3">
      {lista === null ? (
        <p className="font-mono text-[11px] text-texto-2">carregando evidências…</p>
      ) : lista.length === 0 ? (
        <p className="text-xs text-texto-2">Nenhum print ainda.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {lista.map((e) => (
            <li key={e.id} className="group overflow-hidden rounded-md border border-borda bg-fundo">
              <a href={`/api/v1/evidencias/${e.id}`} target="_blank" rel="noopener noreferrer" title="Abrir em tamanho real">
                {/* eslint-disable-next-line @next/next/no-img-element -- imagem autenticada servida pela API */}
                <img src={`/api/v1/evidencias/${e.id}`} alt={e.legenda || `Evidência ${e.id}`} loading="lazy" className="h-28 w-full object-cover object-top" />
              </a>
              <div className="flex items-start justify-between gap-2 px-2 py-1.5">
                <p className="line-clamp-2 text-[11px] leading-snug text-texto-2">{e.legenda || "sem legenda"}</p>
                {podeEditar && (
                  <button
                    type="button"
                    onClick={() => remover(e.id)}
                    aria-label="Remover evidência"
                    className="cursor-pointer font-mono text-[11px] text-texto-2 hover:text-critica"
                  >
                    ✕
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {podeEditar && (
        <label
          className={`inline-flex w-fit cursor-pointer items-center gap-2 rounded-sm border border-borda px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-texto-2 hover:border-accent hover:text-accent ${
            cheia ? "pointer-events-none opacity-50" : ""
          }`}
        >
          + adicionar print (com tarja)
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={cheia}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) setArquivo(f);
            }}
          />
        </label>
      )}

      {arquivo && <EditorTarja arquivo={arquivo} onCancelar={() => setArquivo(null)} onSalvar={enviar} />}
    </div>
  );
}

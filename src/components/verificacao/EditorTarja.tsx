"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { MAX_BYTES_EVIDENCIA, MAX_LEGENDA } from "@/lib/evidencias";

type Retangulo = { x: number; y: number; w: number; h: number };

type Props = {
  arquivo: File;
  onCancelar: () => void;
  onSalvar: (imagem: Blob, legenda: string) => Promise<void>;
};

/** Lado maior do print depois de reduzido (legível e abaixo do teto de tamanho). */
const LADO_MAXIMO = 1800;

function paraBlob(canvas: HTMLCanvasElement, tipo: string, qualidade?: number): Promise<Blob | null> {
  return new Promise((ok) => canvas.toBlob(ok, tipo, qualidade));
}

/**
 * Tarja no navegador: o pentester cobre tokens, CPFs, e-mails do print
 * antes do envio. A imagem enviada é o canvas re-codificado — a original
 * não sai da máquina e os metadados (EXIF/GPS) ficam para trás.
 */
export function EditorTarja({ arquivo, onCancelar, onSalvar }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const imagem = useRef<HTMLImageElement | null>(null);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const [tarjas, setTarjas] = useState<Retangulo[]>([]);
  const [rascunho, setRascunho] = useState<Retangulo | null>(null);
  const [legenda, setLegenda] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const cancelar = useRef(onCancelar);
  cancelar.current = onCancelar;

  useEffect(() => {
    // `cancelado`: no StrictMode o efeito monta, limpa e monta de novo; a
    // imagem da 1ª montagem falha (URL revogada) e não pode sujar o estado.
    let cancelado = false;
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      if (cancelado) return;
      setErro(null);
      imagem.current = img;
      const escala = Math.min(1, LADO_MAXIMO / Math.max(img.naturalWidth, img.naturalHeight));
      const c = canvas.current;
      if (!c) return;
      c.width = Math.round(img.naturalWidth * escala);
      c.height = Math.round(img.naturalHeight * escala);
      setTarjas([]);
    };
    img.onerror = () => {
      if (!cancelado) setErro("Não foi possível abrir a imagem. Use PNG, JPEG ou WebP.");
    };
    img.src = url;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelar.current();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => {
      cancelado = true;
      URL.revokeObjectURL(url);
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [arquivo]);

  // Redesenha imagem + tarjas (as definitivas e a que está sendo puxada).
  useEffect(() => {
    const c = canvas.current;
    const img = imagem.current;
    const ctx = c?.getContext("2d");
    if (!c || !img || !ctx) return;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    ctx.fillStyle = "#000";
    for (const r of [...tarjas, ...(rascunho ? [rascunho] : [])]) ctx.fillRect(r.x, r.y, r.w, r.h);
  });

  function ponto(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = e.currentTarget;
    const caixa = c.getBoundingClientRect();
    return {
      x: ((e.clientX - caixa.left) / caixa.width) * c.width,
      y: ((e.clientY - caixa.top) / caixa.height) * c.height,
    };
  }

  function normalizar(a: { x: number; y: number }, b: { x: number; y: number }): Retangulo {
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
  }

  async function salvar() {
    const c = canvas.current;
    if (!c || !imagem.current) return;
    setSalvando(true);
    setErro(null);
    try {
      // PNG preserva texto nítido; se passar do teto, JPEG.
      let blob = await paraBlob(c, "image/png");
      if (!blob || blob.size > MAX_BYTES_EVIDENCIA * 0.95) blob = await paraBlob(c, "image/jpeg", 0.88);
      if (!blob || blob.size > MAX_BYTES_EVIDENCIA) {
        setErro("Mesmo comprimida, a imagem passou de 2,5 MB. Recorte o print.");
        return;
      }
      await onSalvar(blob, legenda.trim());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar a evidência.");
    } finally {
      setSalvando(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm sm:p-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tarja-titulo"
        className="w-full max-w-5xl rounded-xl border border-borda bg-superficie shadow-2xl"
      >
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-borda px-5 py-4">
          <div>
            <h2 id="tarja-titulo" className="text-base font-semibold text-texto">
              Tarjar dados sensíveis
            </h2>
            <p className="mt-1 text-xs text-texto-2">
              Arraste sobre tokens, senhas, CPFs ou e-mails. A tarja é gravada na imagem aqui no seu
              navegador — o original não é enviado.
            </p>
          </div>
          <span className="font-mono text-[11px] text-texto-2">
            {tarjas.length} tarja{tarjas.length === 1 ? "" : "s"}
          </span>
        </header>

        <div className="max-h-[65vh] overflow-auto bg-fundo p-3">
          <canvas
            ref={canvas}
            aria-label="Print para tarjar: arraste para cobrir uma área"
            className="mx-auto block h-auto max-w-full cursor-crosshair touch-none select-none"
            onPointerDown={(e) => {
              inicio.current = ponto(e);
              // Captura é conforto (arrastar para fora do canvas); se o
              // navegador recusar, o arraste segue funcionando.
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                // sem captura
              }
            }}
            onPointerMove={(e) => {
              if (inicio.current) setRascunho(normalizar(inicio.current, ponto(e)));
            }}
            onPointerUp={(e) => {
              if (!inicio.current) return;
              const r = normalizar(inicio.current, ponto(e));
              inicio.current = null;
              setRascunho(null);
              if (r.w > 3 && r.h > 3) setTarjas((t) => [...t, r]);
            }}
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-borda px-5 py-4">
          <input
            type="text"
            value={legenda}
            maxLength={MAX_LEGENDA}
            onChange={(e) => setLegenda(e.target.value)}
            placeholder="Legenda (ex.: resposta 200 com a fatura de outro usuário)"
            className="w-full rounded-md border border-borda bg-fundo px-3 py-2 text-sm text-texto placeholder:text-texto-2/50"
          />
          {erro && (
            <p role="alert" className="font-mono text-xs text-critica">
              {erro}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variante="fantasma" tamanho="sm" onClick={() => setTarjas((t) => t.slice(0, -1))} disabled={!tarjas.length || salvando}>
              desfazer
            </Button>
            <Button variante="fantasma" tamanho="sm" onClick={() => setTarjas([])} disabled={!tarjas.length || salvando}>
              limpar tarjas
            </Button>
            <Button variante="secundaria" tamanho="sm" onClick={onCancelar} disabled={salvando}>
              cancelar
            </Button>
            <Button variante="primaria" tamanho="sm" onClick={salvar} disabled={salvando}>
              {salvando ? (
                <>
                  <Spinner /> enviando…
                </>
              ) : (
                "salvar evidência"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

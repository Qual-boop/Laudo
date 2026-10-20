"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/Card";
import { Field, Input } from "@/components/Field";

type Marca = {
  nome: string | null;
  cor: string | null;
  logo: string | null;
  responsavel: string | null;
  contato: string | null;
};

const MAX_BYTES = 200 * 1024;

/** Bytes reais de um data URL base64. */
function tamanho(dataUrl: string): number {
  const b64 = dataUrl.split(",")[1] ?? "";
  return Math.floor((b64.length * 3) / 4);
}

/**
 * Reduz o logo no navegador (máx. 600×240) antes de enviar: PNG mantém a
 * transparência; se passar de 200 KB, tenta WebP.
 */
async function prepararLogo(arquivo: File): Promise<string> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, 600 / bitmap.width, 240 / bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * escala));
  canvas.height = Math.max(1, Math.round(bitmap.height * escala));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let url = canvas.toDataURL("image/png");
  if (tamanho(url) > MAX_BYTES) url = canvas.toDataURL("image/webp", 0.85);
  if (tamanho(url) > MAX_BYTES) throw new Error("Logo grande demais mesmo reduzido. Use uma imagem mais simples.");
  return url;
}

/** Card do perfil: nome, cor, logo, responsável e contato no PDF. */
export function MarcaPdf() {
  const [marca, setMarca] = useState<Marca | null>(null);
  const [permitido, setPermitido] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  useEffect(() => {
    fetch("/api/v1/marca")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { permitido: boolean; marca: Marca } | null) => {
        if (!d) return;
        setPermitido(d.permitido);
        setMarca(d.marca);
      })
      .catch(() => {});
  }, []);

  function campo<K extends keyof Marca>(k: K, v: Marca[K]) {
    setMarca((m) => (m ? { ...m, [k]: v } : m));
  }

  async function escolherLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setAviso(null);
    try {
      campo("logo", await prepararLogo(arquivo));
    } catch (err) {
      setAviso({ tipo: "erro", texto: err instanceof Error ? err.message : "Não foi possível ler a imagem." });
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!marca) return;
    setSalvando(true);
    setAviso(null);
    try {
      const res = await fetch("/api/v1/marca", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(marca),
      });
      const corpo = (await res.json().catch(() => null)) as { error?: string } | null;
      setAviso(
        res.ok
          ? { tipo: "ok", texto: "Marca salva. Os próximos PDFs já saem com ela." }
          : { tipo: "erro", texto: corpo?.error ?? "Não foi possível salvar." },
      );
    } catch {
      setAviso({ tipo: "erro", texto: "Não foi possível conectar ao servidor." });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sua marca no PDF</CardTitle>
        <CardDescription>
          {permitido
            ? "O relatório e o resumo executivo saem com o logo, o nome e a cor da sua consultoria."
            : "Nos planos Pro e Team, o PDF sai com o logo, o nome e a cor da sua consultoria."}
        </CardDescription>
      </CardHeader>

      {!permitido ? (
        <div className="px-5 py-4 sm:px-6">
          <a href="/precos" className="font-mono text-xs uppercase tracking-wider text-accent hover:underline">
            ver planos →
          </a>
        </div>
      ) : !marca ? (
        <p className="px-5 py-4 font-mono text-xs text-texto-2 sm:px-6">carregando…</p>
      ) : (
        <form onSubmit={salvar} className="flex flex-col gap-4 px-5 py-4 sm:px-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome da consultoria" htmlFor="marca-nome">
              <Input
                id="marca-nome"
                maxLength={80}
                placeholder="Ex.: Seabra Segurança"
                value={marca.nome ?? ""}
                onChange={(e) => campo("nome", e.target.value)}
              />
            </Field>
            <Field label="Responsável técnico" htmlFor="marca-resp" dica="nome e certificação">
              <Input
                id="marca-resp"
                maxLength={120}
                placeholder="Ex.: Elias Seabra, OSCP"
                value={marca.responsavel ?? ""}
                onChange={(e) => campo("responsavel", e.target.value)}
              />
            </Field>
            <Field label="Contato" htmlFor="marca-contato" dica="e-mail ou site">
              <Input
                id="marca-contato"
                maxLength={160}
                placeholder="contato@consultoria.com.br"
                value={marca.contato ?? ""}
                onChange={(e) => campo("contato", e.target.value)}
              />
            </Field>
            <Field label="Cor da marca" htmlFor="marca-cor">
              <div className="flex items-center gap-3">
                <input
                  id="marca-cor"
                  type="color"
                  value={marca.cor ?? "#047857"}
                  onChange={(e) => campo("cor", e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded border border-borda bg-transparent"
                />
                <span className="font-mono text-xs text-texto-2">{marca.cor ?? "padrão"}</span>
              </div>
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-16 w-44 items-center justify-center rounded-md border border-dashed border-borda bg-white p-2">
              {marca.logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- prévia do data URL
                <img src={marca.logo} alt="Prévia do logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="font-mono text-[10px] text-slate-500">sem logo</span>
              )}
            </div>
            <label className="cursor-pointer font-mono text-[11px] uppercase tracking-wider text-accent hover:underline">
              escolher logo (PNG, JPG ou WebP)
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={escolherLogo} />
            </label>
            {marca.logo && (
              <button
                type="button"
                onClick={() => campo("logo", null)}
                className="cursor-pointer font-mono text-[11px] text-texto-2 hover:text-critica"
              >
                remover logo
              </button>
            )}
          </div>

          {aviso && (
            <p role={aviso.tipo === "erro" ? "alert" : "status"} className={`font-mono text-xs ${aviso.tipo === "erro" ? "text-critica" : "text-accent"}`}>
              {aviso.texto}
            </p>
          )}

          <Button variante="primaria" type="submit" disabled={salvando} className="sm:w-fit">
            {salvando ? "salvando…" : "salvar marca"}
          </Button>
        </form>
      )}
    </Card>
  );
}

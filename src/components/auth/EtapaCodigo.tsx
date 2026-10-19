"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Field, Input } from "@/components/Field";

type Props = {
  destino: string;
  reenvioEmSeg: number;
  onConfirmar: (codigo: string) => Promise<{ ok: true } | { ok: false; erro: string }>;
  onReenviar: () => Promise<{ ok: true } | { ok: false; erro: string }>;
  onVoltar: () => void;
  rotuloBotao?: string;
};

/**
 * 2ª etapa: o código de 6 dígitos enviado por e-mail.
 * `autocomplete="one-time-code"` deixa o celular sugerir o código sozinho.
 */
export function EtapaCodigo({
  destino,
  reenvioEmSeg,
  onConfirmar,
  onReenviar,
  onVoltar,
  rotuloBotao = "entrar",
}: Props) {
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [espera, setEspera] = useState(reenvioEmSeg);

  useEffect(() => setEspera(reenvioEmSeg), [reenvioEmSeg]);
  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setAviso("");
    setEnviando(true);
    const r = await onConfirmar(codigo);
    setEnviando(false);
    if (!r.ok) {
      setErro(r.erro);
      setCodigo("");
    }
  }

  async function reenviar() {
    setErro("");
    setAviso("");
    const r = await onReenviar();
    if (r.ok) setAviso("Enviamos um código novo. O anterior deixou de valer.");
    else setErro(r.erro);
  }

  return (
    <form onSubmit={confirmar} className="flex flex-col gap-4 p-5 sm:p-6">
      <p className="text-sm leading-relaxed text-texto-2">
        Enviamos um código de 6 dígitos para <strong className="text-texto">{destino}</strong>.
        Ele vale por 10 minutos.
      </p>

      <Field label="Código" htmlFor="codigo-email">
        <Input
          id="codigo-email"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={7}
          required
          autoFocus
          placeholder="000000"
          className="text-center font-mono text-2xl tracking-[0.5em]"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
        />
      </Field>

      {erro && (
        <p role="alert" className="font-mono text-xs text-critica">
          {erro}
        </p>
      )}
      {aviso && (
        <p role="status" className="font-mono text-xs text-accent">
          {aviso}
        </p>
      )}

      <Button
        variante="primaria"
        tamanho="lg"
        type="submit"
        disabled={enviando || codigo.length !== 6}
      >
        {enviando ? "conferindo…" : rotuloBotao}
      </Button>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onVoltar}
          className="cursor-pointer text-texto-2 hover:text-accent"
        >
          ← trocar e-mail
        </button>
        <button
          type="button"
          onClick={reenviar}
          disabled={espera > 0}
          className="cursor-pointer text-accent hover:underline disabled:cursor-not-allowed disabled:text-texto-2 disabled:no-underline"
        >
          {espera > 0 ? `reenviar em ${espera}s` : "reenviar código"}
        </button>
      </div>
    </form>
  );
}

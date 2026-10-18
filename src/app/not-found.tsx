import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Página não encontrada — Provafix",
  description: "A página solicitada não existe ou foi movida.",
};

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <span aria-hidden="true" className="font-mono text-6xl text-texto-2/30">
        404
      </span>
      <h1 className="text-xl font-semibold tracking-tight text-texto">Página não encontrada</h1>
      <p className="text-sm text-texto-2">
        A página que você procura não existe ou foi movida. Verifique o endereço
        e tente novamente.
      </p>
      <Link
        href="/"
        className="interativo inline-flex items-center justify-center rounded-md border border-accent px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-accent hover:bg-accent hover:text-fundo"
      >
        voltar ao início
      </Link>
    </div>
  );
}
import type { Metadata } from "next";
import { SeletorPrecos } from "@/components/precos/SeletorPrecos";

export const metadata: Metadata = {
  title: "Planos e preços — Provafix",
  description:
    "Comece grátis e faça upgrade para Pro ou Team quando precisar de relatórios ilimitados, exportação Jira/GitHub e certificado de correção.",
};

export default function Precos() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-14 sm:px-6 sm:py-20">
      <div className="revelar text-center">
        <p className="font-mono text-[11px] uppercase tracking-widest text-accent">
          planos e preços
        </p>
        <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-bold leading-[1.05] tracking-tight text-texto sm:text-5xl">
          Comece grátis. <span className="texto-gradiente">Escale quando precisar.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-texto-2">
          Sem cartão para começar. Cancele quando quiser, mantendo seus dados.
        </p>
      </div>

      <SeletorPrecos />
    </main>
  );
}

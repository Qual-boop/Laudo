import type { Metadata } from "next";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Termos de uso — Laudo",
  description: "Termos de uso da plataforma Laudo (beta).",
};

export default function Termos() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <Logo className="h-8 w-8 text-accent" />
        <span className="text-lg font-bold tracking-tight text-texto">Laudo</span>
      </div>
      <p className="font-mono text-[11px] uppercase tracking-widest text-accent">
        Termos de uso · beta
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-texto">
        Termos de uso
      </h1>
      <div className="mt-8 flex flex-col gap-5 text-sm leading-relaxed text-texto-2">
        <p>
          O Laudo é uma plataforma de apoio a testes de intrusão: gera
          rascunhos de relatório com IA, acompanha retestes e emite
          certificados de correção. O conteúdo gerado por IA é sugestão —
          <strong className="text-texto">revise tudo antes de entregar ao cliente</strong>.
        </p>
        <p>
          Seus dados ficam isolados por conta e nunca são compartilhados.
          Evidências enviadas à IA seguem para os provedores configurados
          (Gemini/Groq) — anonimize antes se o engagement exigir.
        </p>
        <p>
          O serviço é fornecido "como está", sem garantias. Dúvidas:{" "}
          <a href="mailto:contato@laudo.app" className="text-accent hover:underline">
            contato@laudo.app
          </a>
          .
        </p>
      </div>
      <a
        href="/"
        className="mt-10 inline-flex items-center justify-center rounded-md border border-borda px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-texto-2 transition-colors hover:border-accent hover:text-accent"
      >
        ← voltar
      </a>
    </main>
  );
}

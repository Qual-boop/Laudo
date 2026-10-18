import type { Metadata } from "next";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Privacidade — Provafix",
  description: "Como o Provafix trata seus dados (beta).",
};

export default function Privacidade() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <Logo className="h-8 w-8 text-accent" />
        <span className="text-lg font-bold tracking-tight text-texto">Provafix</span>
      </div>
      <p className="font-mono text-[11px] uppercase tracking-widest text-accent">
        Privacidade · beta
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-texto">
        Privacidade
      </h1>
      <div className="mt-8 flex flex-col gap-5 text-sm leading-relaxed text-texto-2">
        <p>
          <strong className="text-texto">Conta:</strong> nome, e-mail e hash
          bcrypt da senha. Sem senha em plaintext, em nenhum lugar.
        </p>
        <p>
          <strong className="text-texto">Relatórios:</strong> visíveis só para
          a sua conta. Apagar a conta apaga tudo (cascata no banco).
        </p>
        <p>
          <strong className="text-texto">IA:</strong> na geração, o conteúdo dos
          achados é enviado ao provedor de IA (Google Gemini; Groq como reserva),
          que pode processá-lo fora do Brasil. Antes do envio, o Escudo de
          privacidade substitui IPs, domínios, e-mails, CPF/CNPJ, números de
          cartão, senhas, tokens, cookies e o nome do cliente por marcadores; a
          correspondência fica só na memória da requisição e não é armazenada.
          Nomes internos que não seguem esses padrões não são reconhecidos. Sem
          analytics, sem cookies de terceiros, sem rastreamento.
        </p>
        <p>
          Pedidos de exportação/exclusão (LGPD):{" "}
          <a href="mailto:eliasmecenasseabra@gmail.com" className="text-accent hover:underline">
            eliasmecenasseabra@gmail.com
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

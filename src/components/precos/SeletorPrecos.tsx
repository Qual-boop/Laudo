"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

type PlanoId = "free" | "pro" | "team";

const PLANOS: {
  id: PlanoId;
  nome: string;
  descricao: string;
  mensal: number | null;
  anual: number | null;
  cta: string;
  href: string;
  destaque?: boolean;
  features: string[];
}[] = [
  {
    id: "free",
    nome: "Free",
    descricao: "Para quem está começando",
    mensal: 0,
    anual: 0,
    cta: "Começar grátis",
    href: "/cadastro",
    features: [
      "3 relatórios por mês",
      "5 achados por relatório",
      "10 retestes por mês",
      "Exportação em texto simples",
      "Histórico de 30 dias",
    ],
  },
  {
    id: "pro",
    nome: "Pro",
    descricao: "Para freelancers",
    mensal: 19.9,
    anual: 191.04,
    cta: "Assinar Pro",
    href: "/cadastro?plano=pro",
    destaque: true,
    features: [
      "Relatórios ilimitados",
      "Achados ilimitados por relatório",
      "Retestes ilimitados",
      "Exportação Jira e GitHub",
      "Certificado de correção",
      "Sem marca d'água",
      "Histórico ilimitado",
      "Suporte por email",
    ],
  },
  {
    id: "team",
    nome: "Team",
    descricao: "Para consultorias",
    mensal: 49.9,
    anual: 479.04,
    cta: "Assinar Team",
    href: "/cadastro?plano=team",
    features: [
      "Tudo do Pro",
      "Recursos de equipe (em desenvolvimento)",
      "Suporte prioritário",
    ],
  },
];

const FAQ: { pergunta: string; resposta: string }[] = [
  {
    pergunta: "O que acontece quando atinjo o limite do Free?",
    resposta:
      "A ação é bloqueada com uma mensagem clara (ex.: 3/3 relatórios este mês) e um convite para upgrade. Nada é apagado e você continua vendo tudo que já criou.",
  },
  {
    pergunta: "Posso cancelar quando quiser?",
    resposta:
      "Sim. O cancelamento vale ao fim do ciclo pago e sua conta volta para o Free com os dados intactos.",
  },
  {
    pergunta: "Como funciona o desconto anual?",
    resposta:
      "O plano anual custa 20% menos que 12 mensalidades (Pro: R$ 191,04/ano; Team: R$ 479,04/ano por usuário).",
  },
  {
    pergunta: "O certificado de correção está em quais planos?",
    resposta:
      "Pro e Team. No Free, a página do certificado mostra o bloqueio com link para os planos.",
  },
  {
    pergunta: "Meus dados saem do país?",
    resposta:
      "Só o texto técnico mascarado. Na geração, o Escudo de privacidade troca IPs, domínios, e-mails, CPF/CNPJ, cartões, senhas, tokens e o nome do cliente por marcadores; esse texto vai ao provedor de IA (Google Gemini; Groq como reserva), que pode processá-lo fora do Brasil, e os dados reais voltam só no seu relatório. Nomes internos fora desses padrões não são reconhecidos — revise antes de gerar. Não usamos analytics nem cookies de terceiros.",
  },
];

function reais(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Cards de planos + FAQ (client: toggle mensal/anual). */
export function SeletorPrecos() {
  const [anual, setAnual] = useState(false);
  const { status } = useSession();
  const [erroCheckout, setErroCheckout] = useState<string | null>(null);
  const [pagando, setPagando] = useState<PlanoId | null>(null);

  // Logado: vai direto ao checkout. Deslogado: cria conta primeiro.
  async function assinar(plano: PlanoId, hrefCadastro: string) {
    if (plano === "free" || status !== "authenticated") {
      window.location.href = hrefCadastro;
      return;
    }
    setErroCheckout(null);
    setPagando(plano);
    try {
      const res = await fetch("/api/v1/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano, periodo: anual ? "anual" : "mensal" }),
      });
      const corpo = (await res.json().catch(() => null)) as {
        url?: string;
        error?: string;
      } | null;
      if (!res.ok || !corpo?.url) {
        setErroCheckout(corpo?.error ?? "Checkout indisponível no momento.");
        return;
      }
      window.location.href = corpo.url;
    } catch {
      setErroCheckout("Não foi possível conectar ao servidor.");
    } finally {
      setPagando(null);
    }
  }

  return (
    <>
      {/* Toggle mensal/anual */}
      <div className="revelar mt-10 flex items-center justify-center gap-3">
        <span className={`font-mono text-[11px] uppercase tracking-wider ${!anual ? "text-texto" : "text-texto-2"}`}>
          Mensal
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={anual}
          aria-label="Alternar entre cobrança mensal e anual"
          onClick={() => setAnual((v) => !v)}
          className="relative h-7 w-13 shrink-0 cursor-pointer rounded-full border border-borda bg-superficie p-1 transition-colors duration-200 hover:border-accent/50"
          style={{ width: "3.25rem" }}
        >
          <span
            aria-hidden="true"
            className={`block h-5 w-5 rounded-full bg-accent transition-transform duration-200 ${
              anual ? "translate-x-[1.375rem]" : "translate-x-0"
            }`}
          />
        </button>
        <span className={`font-mono text-[11px] uppercase tracking-wider ${anual ? "text-texto" : "text-texto-2"}`}>
          Anual
        </span>
        <span className="rounded-sm bg-accent/15 px-1.5 py-0.5 font-mono text-[10px] text-accent">
          -20%
        </span>
      </div>

      {/* Cards */}
      {erroCheckout && (
        <p role="alert" className="mx-auto mt-6 max-w-xl text-center font-mono text-xs text-critica">
          {erroCheckout}
        </p>
      )}
      <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {PLANOS.map((p, i) => {
          const preco = anual ? p.anual : p.mensal;
          return (
            <article
              key={p.id}
              className={`revelar relative flex flex-col rounded-xl border p-6 sm:p-7 ${
                p.destaque
                  ? "glass border-accent/50 shadow-[0_0_48px_-12px_var(--color-accent)] lg:scale-[1.04]"
                  : "glass"
              }`}
              style={{ animationDelay: `${i * 90}ms` }}
            >
              {p.destaque && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-accent bg-fundo px-3 py-0.5 font-mono text-[10px] uppercase tracking-widest text-accent">
                  Mais popular
                </span>
              )}
              <h2 className="text-lg font-bold tracking-tight text-texto">{p.nome}</h2>
              <p className="mt-1 text-sm text-texto-2">{p.descricao}</p>
              <p className="mt-5 flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tight text-texto">
                  {preco === null || preco === 0 ? (p.mensal === 0 ? "R$ 0" : "—") : reais(preco)}
                </span>
                <span className="font-mono text-[11px] text-texto-2">
                  {p.mensal === 0 ? "para sempre" : anual ? "/ano" : "/mês"}
                </span>
              </p>
              {anual && p.mensal !== 0 && p.mensal !== null && (
                <p className="mt-1 font-mono text-[11px] text-accent">
                  equivale a {reais(p.mensal * 0.8)}/mês
                </p>
              )}
              <ul className="mt-6 flex flex-1 flex-col gap-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-texto-2">
                    <span aria-hidden="true" className="mt-0.5 font-mono text-xs text-accent">
                      ✓
                    </span>
                    <span className="leading-snug">{f}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => assinar(p.id, p.href)}
                disabled={pagando !== null}
                className={`mt-7 inline-flex cursor-pointer items-center justify-center rounded-lg border px-4 py-3 font-mono text-xs uppercase tracking-wider transition-all duration-200 active:scale-[0.98] disabled:opacity-60 ${
                  p.destaque
                    ? "border-accent bg-gradient-to-b from-accent to-accent/70 text-fundo shadow-[0_0_20px_-6px_var(--color-accent)] hover:brightness-110"
                    : "border-borda text-texto-2 hover:border-accent hover:text-accent"
                }`}
              >
                {pagando === p.id ? "abrindo checkout…" : p.cta}
              </button>
            </article>
          );
        })}
      </div>

      {/* FAQ */}
      <section className="mx-auto mt-20 max-w-3xl">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-texto sm:text-3xl">
          Perguntas frequentes
        </h2>
        <div className="mt-8 flex flex-col gap-3">
          {FAQ.map((f) => (
            <details
              key={f.pergunta}
              className="group rounded-xl border border-borda bg-superficie px-5 py-4"
            >
              <summary className="cursor-pointer list-none text-sm font-semibold text-texto marker:hidden [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-4">
                  {f.pergunta}
                  <span aria-hidden="true" className="font-mono text-accent transition-transform group-open:rotate-45">
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-texto-2">{f.resposta}</p>
            </details>
          ))}
        </div>
      </section>

    </>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { precoMensal } from "@/lib/planos";

export type InfoPaywall = {
  recurso: "relatorios" | "retestes" | "achados" | "geracoes" | string;
  usados: number;
  limite: number;
  plano?: "free" | "pro" | "team" | string;
};

const ROTULO_RECURSO: Record<string, string> = {
  relatorios: "relatórios este mês",
  retestes: "retestes este mês",
  achados: "achados por relatório",
  geracoes: "gerações com IA este mês",
};

/**
 * Se a resposta é o 402 de limite do plano, abre o paywall e devolve true
 * (o chamador não mostra toast). Qualquer outro erro: false.
 */
export function abrirPaywallSe402(res: Response, corpo: unknown): boolean {
  const c = corpo as Partial<InfoPaywall> | null;
  if (
    res.status !== 402 ||
    !c ||
    typeof c.recurso !== "string" ||
    typeof c.usados !== "number" ||
    typeof c.limite !== "number"
  ) {
    return false;
  }
  dispararPaywall({ recurso: c.recurso, usados: c.usados, limite: c.limite, plano: c.plano });
  return true;
}

const EVENTO = "laudo:paywall";
const UM_DIA_MS = 24 * 60 * 60 * 1000;

/** Pura e testável: mostra no máximo 1x por dia por recurso. */
export function podeExibir(ultimaExibicao: number | null, agora = Date.now()): boolean {
  if (ultimaExibicao === null) return true;
  return agora - ultimaExibicao >= UM_DIA_MS;
}

function chaveLocal(recurso: string): string {
  return `paywall_${recurso}`;
}

/** Dispara o paywall de qualquer lugar (resposta 402 da API). */
export function dispararPaywall(info: InfoPaywall): void {
  window.dispatchEvent(new CustomEvent<InfoPaywall>(EVENTO, { detail: info }));
}

/** Ouve 402s, abre o modal com throttle de 1x/dia por recurso. */
export function usePaywall(): { info: InfoPaywall | null; fechar: () => void } {
  const [info, setInfo] = useState<InfoPaywall | null>(null);

  useEffect(() => {
    function aoEvento(e: Event) {
      const detalhe = (e as CustomEvent<InfoPaywall>).detail;
      try {
        const ultima = localStorage.getItem(chaveLocal(detalhe.recurso));
        if (!podeExibir(ultima ? Number(ultima) : null)) return;
        localStorage.setItem(chaveLocal(detalhe.recurso), String(Date.now()));
      } catch {
        // localStorage indisponível: mostra mesmo assim.
      }
      setInfo(detalhe);
    }
    window.addEventListener(EVENTO, aoEvento);
    return () => window.removeEventListener(EVENTO, aoEvento);
  }, []);

  const fechar = useCallback(() => setInfo(null), []);

  // Escape fecha.
  useEffect(() => {
    if (!info) return;
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") setInfo(null);
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [info]);

  return { info, fechar };
}

const TEXTO_POR_PLANO: Record<
  "free" | "pro" | "team",
  { nomePlano: string; chamada: string; beneficios: string[]; cta: string | null }
> = {
  free: {
    nomePlano: "Free",
    chamada: "Faça upgrade para o Pro e continue com até 300 relatórios por mês.",
    beneficios: [
      "300 relatórios por mês, achados e retestes ilimitados",
      "Exportação Jira e GitHub em todos os formatos",
      "Certificado de correção sem marca d'água",
    ],
    cta: `Assinar Pro por ${precoMensal("pro")}/mês`,
  },
  pro: {
    nomePlano: "Pro",
    chamada: "A cota renova no dia 1. Se precisar de mais agora, o Team triplica o limite.",
    beneficios: [
      "900 relatórios por mês",
      "Compartilhar relatórios com até 10 colegas",
      "Comentários de revisão por achado",
    ],
    cta: "Ver o plano Team",
  },
  team: {
    nomePlano: "Team",
    chamada: "A cota renova no dia 1. Precisa de mais? Fale com a gente pelo e-mail de suporte.",
    beneficios: [],
    cta: null,
  },
};

/** Modal de upgrade quando um plano atinge o limite do mês. */
export function PaywallModal({
  info,
  onFechar,
}: {
  info: InfoPaywall;
  onFechar: () => void;
}) {
  const rotulo = ROTULO_RECURSO[info.recurso] ?? info.recurso;
  const texto =
    TEXTO_POR_PLANO[info.plano === "pro" || info.plano === "team" ? info.plano : "free"];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-fundo/80 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`Limite do plano ${texto.nomePlano} atingido`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div className="glass w-full max-w-md rounded-xl p-6 shadow-[0_8px_60px_-12px_var(--color-accent)] sm:p-8">
        <p className="font-mono text-[11px] uppercase tracking-widest text-media">
          limite atingido · {info.usados}/{info.limite} {rotulo}
        </p>
        <h2 className="mt-3 text-xl font-bold tracking-tight text-texto">
          Você atingiu o limite do plano {texto.nomePlano}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-texto-2">{texto.chamada}</p>

        <ul className="mt-5 flex flex-col gap-2.5">
          {texto.beneficios.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-sm text-texto-2">
              <span aria-hidden="true" className="mt-0.5 font-mono text-xs text-accent">
                ✓
              </span>
              <span className="leading-snug">{b}</span>
            </li>
          ))}
        </ul>

        <div className="mt-7 flex flex-col gap-2.5">
          {texto.cta && (
            <a
              href="/precos"
              className="inline-flex items-center justify-center rounded-lg border border-accent bg-gradient-to-b from-accent to-accent/70 px-4 py-3 font-mono text-xs uppercase tracking-wider text-fundo shadow-[0_0_20px_-6px_var(--color-accent)] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
            >
              {texto.cta}
            </a>
          )}
          <div className="flex gap-2.5">
            <a
              href="/precos"
              className="inline-flex flex-1 items-center justify-center rounded-lg border border-borda px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-texto-2 transition-colors hover:border-accent hover:text-accent"
            >
              Ver todos os planos
            </a>
            <Button variante="fantasma" onClick={onFechar} className="flex-1">
              Agora não
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

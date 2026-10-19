"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

type EtapaOnboarding = "step1" | "step2" | "step3" | "step4";

const ETAPAS: Record<EtapaOnboarding, { titulo: string; descricao: string; botao: string }> = {
  step1: {
    titulo: "Preencher engagement",
    descricao: "Digite os dados do seu teste de intrusão: cliente, título, escopo, período e ferramentas usadas.",
    botao: "Próximo",
  },
  step2: {
    titulo: "Adicionar achados",
    descricao: "Descreva cada achado com título, severidade, CWE, confiança, descrição e evidência. O título de pelo menos um achado é obrigatório para gerar o relatório.",
    botao: "Próximo",
  },
  step3: {
    titulo: "Gerar relatório",
    descricao: "Clique em 'Gerar relatório' e aguarde a IA processar seus dados e criar o relatório completo com todas as seções.",
    botao: "Próximo",
  },
  step4: {
    titulo: "Exportar e compartilhar",
    descricao: "Use os botões de exportar PDF, Jira ou GitHub. Também é possível emitir o certificado de correção e realizar retestes.",
    botao: "Concluir",
  },
};

interface OnboardingProps {
  alreadyShown?: boolean;
}

export function Onboarding({ alreadyShown }: OnboardingProps = {}) {
  const [etapa, setEtapa] = useState<EtapaOnboarding>("step1");
  // Lido já no primeiro render (o componente só monta no cliente): antes
  // começava `true` e o tour piscava na tela de quem já tinha visto (F17).
  const [shown, setShown] = useState(() => {
    if (alreadyShown) return false;
    try {
      return !localStorage.getItem("onboarding_shown");
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (alreadyShown) setShown(false);
  }, [alreadyShown]);

  // Escape fecha o tour — acessibilidade por teclado.
  useEffect(() => {
    if (!shown) return;
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") {
        localStorage.setItem("onboarding_shown", "true");
        setShown(false);
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [shown]);

  // Marcar como mostrado ao concluir
  const concluir = () => {
    localStorage.setItem("onboarding_shown", "true");
    setShown(false);
  };

  if (!shown) {
    return null;
  }

  const nextEtapa = (etapaAtual: EtapaOnboarding): EtapaOnboarding => {
    const keys = ["step1", "step2", "step3", "step4"] as const;
    const idx = keys.indexOf(etapaAtual);
    return keys[Math.min(idx + 1, keys.length - 1)] as EtapaOnboarding;
  };

  const prox = () => {
    if (etapa === "step4") {
      concluir();
      return;
    }
    setEtapa(nextEtapa(etapa));
  };

  const etapaAtual = ETAPAS[etapa];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-fundo/80 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`Onboarding — ${etapaAtual.titulo}`}
    >
      <div className="glass w-full max-w-md rounded-xl p-6 shadow-[0_8px_60px_-12px_var(--color-accent)]">
        <Card className="p-6">
          <h3 className="text-accent text-[13px] uppercase tracking-widest mb-4">
            {etapaAtual.titulo}
          </h3>

          <p className="text-texto-2/70 text-sm mb-6 linha-accent">{etapaAtual.descricao}</p>

          <div className="flex gap-3">
            <Button
              variante="secundaria"
              onClick={() => {
                if (etapa === "step1") {
                  localStorage.setItem("onboarding_shown", "true");
                  setShown(false);
                } else {
                  setEtapa("step1");
                }
              }}
              className="flex-1"
            >
              {etapa !== "step1" ? "Voltar" : "Fechar"}
            </Button>
            <Button variante="primaria" onClick={prox} className="flex-1">
              {etapaAtual.botao}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
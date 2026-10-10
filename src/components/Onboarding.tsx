"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useToast } from "@/components/Toast";

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
  const [shown, setShown] = useState(true);
  const { sucesso, aviso } = useToast();

  // Verificar se já foi mostrado
  useEffect(() => {
    const jaMostrado = alreadyShown || localStorage.getItem("onboarding_shown");
    if (jaMostrado) {
      setShown(false);
    }
  }, [alreadyShown]);

  // Marcar como mostrado ao concluir
  const concluir = () => {
    localStorage.setItem("onboarding_shown", "true");
    setShown(false);
  };

  if (!shown) {
    return null;
  }

  const nextEtapa = (etapaAtual: EtapaOnboarding): EtapaOnboarding => {
    if (etapaAtual === "step4") {
      concluir();
      return "step1" as EtapaOnboarding;
    }
    const keys = ["step1", "step2", "step3", "step4"] as const;
    const idx = keys.indexOf(etapaAtual);
    return keys[idx + 1] as EtapaOnboarding;
  };

  const prox = () => {
    setEtapa(nextEtapa);
  };

  const etapaAtual = ETAPAS[etapa];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="bg-texto-2/80 backdrop-blur-sm rounded-md w-full max-w-md border border-borda p-6">
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
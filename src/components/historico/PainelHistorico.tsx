"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/Alert";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Spinner } from "@/components/Spinner";
import type { Relatorio, ResumoRelatorio } from "@/lib/tipos";

type Props = {
  onAbrir: (relatorio: Relatorio) => void;
};

const RISCOS: Record<string, string> = {
  Critico: "text-critica",
  Alto: "text-alta",
  Medio: "text-media",
  Baixo: "text-baixa",
};

export function PainelHistorico({ onAbrir }: Props) {
  const [lista, setLista] = useState<ResumoRelatorio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/relatorios");
      if (!res.ok) throw new Error("falha");
      setLista((await res.json()) as ResumoRelatorio[]);
      setErro(null);
    } catch {
      setErro("Não foi possível carregar o histórico.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function abrir(id: number) {
    setAbrindo(id);
    try {
      const res = await fetch(`/api/relatorios/${id}`);
      if (!res.ok) throw new Error("falha");
      onAbrir((await res.json()) as Relatorio);
    } catch {
      setErro("Não foi possível abrir o relatório.");
    } finally {
      setAbrindo(null);
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-md border border-dashed border-borda px-6 py-16 font-mono text-xs text-texto-2">
        <Spinner />
        carregando histórico…
      </div>
    );
  }

  if (lista.length === 0) {
    return (
      <Card className="px-6 py-14 text-center">
        <p className="font-mono text-xs text-texto-2">
          nenhum relatório salvo
          <span className="animate-blink text-accent"> ▋</span>
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-texto-2/70">
          Gere um relatório na aba “Novo” e salve para guardar o histórico e
          habilitar a verificação de correções.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {erro && <Alert tom="erro">{erro}</Alert>}

      {lista.map((r) => (
        <article
          key={r.id}
          className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-borda bg-superficie px-5 py-4"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] tracking-wider text-accent">
                #{r.id}
              </span>
              <span
                className={`font-mono text-[10px] uppercase tracking-wider ${
                  RISCOS[r.risco_geral] ?? "text-texto-2"
                }`}
              >
                risco {String(r.risco_geral ?? "").toLowerCase()}
              </span>
            </div>
            <h3 className="mt-1.5 text-sm font-medium text-texto">{r.cliente}</h3>
            <p className="mt-0.5 font-mono text-[11px] text-texto-2">
              {r.titulo} · {r.data} · v{r.versao} · {r.total_achados} achado
              {r.total_achados === 1 ? "" : "s"}
            </p>
          </div>

          <Button
            variante="secundaria"
            tamanho="sm"
            onClick={() => abrir(r.id)}
            disabled={abrindo === r.id}
          >
            {abrindo === r.id ? "abrindo..." : "abrir"}
          </Button>
        </article>
      ))}
    </div>
  );
}

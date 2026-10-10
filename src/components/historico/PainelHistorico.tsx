"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { EstadoVazio, ListaSkeleton } from "@/components/verificacao/PainelBase";
import type { Relatorio, ResumoRelatorio } from "@/lib/tipos";

type Props = {
  onAbrir: (relatorio: Relatorio) => void;
  onAviso: (texto: string) => void;
  onResumo: (relatorio: ResumoRelatorio[]) => void;
};

const RISCOS: Record<string, string> = {
  Critico: "text-critica",
  Alto: "text-alta",
  Medio: "text-media",
  Baixo: "text-baixa",
};

export function PainelHistorico({ onAbrir, onAviso, onResumo }: Props) {
  const [lista, setLista] = useState<ResumoRelatorio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [abrindo, setAbrindo] = useState<number | null>(null);

  const carregar = useCallback(
    async (signal?: AbortSignal) => {
      setCarregando(true);
      try {
        const res = await fetch("/api/v1/relatorios", { signal });
        if (!res.ok) throw new Error("falha");
        const dados = (await res.json()) as ResumoRelatorio[];
        if (signal?.aborted) return;
        setLista(dados);
        onResumo(dados);
      } catch (e) {
        // Abort no cleanup (troca de aba / desmontagem) não é erro.
        if (e instanceof DOMException && e.name === "AbortError") return;
        onAviso("Não foi possível carregar o histórico.");
      } finally {
        if (!signal?.aborted) setCarregando(false);
      }
    },
    [onAviso, onResumo],
  );

  useEffect(() => {
    const controlador = new AbortController();
    void carregar(controlador.signal);
    return () => controlador.abort();
  }, [carregar]);

  async function abrir(id: number) {
    setAbrindo(id);
    try {
      const res = await fetch(`/api/v1/relatorios/${id}`);
      if (!res.ok) throw new Error("falha");
      onAbrir((await res.json()) as Relatorio);
    } catch {
      onAviso("Não foi possível abrir o relatório.");
    } finally {
      setAbrindo(null);
    }
  }

  if (carregando) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2 font-mono text-[11px] text-texto-2">
          <Spinner />
          carregando histórico…
        </div>
        <ListaSkeleton linhas={3} />
      </div>
    );
  }

  if (lista.length === 0) {
    return (
      <EstadoVazio
        icone="▤"
        titulo="Nenhum relatório salvo ainda"
        descricao="Crie o primeiro: gere o relatório na aba “Novo” e salve. Ele fica no histórico e libera a verificação de correções."
        cta={{ rotulo: "criar relatório", href: "#" }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {lista.map((r) => (
        <article
          key={r.id}
          className="interativo flex flex-wrap items-center justify-between gap-4 rounded-md border border-borda bg-superficie px-5 py-4 hover:border-accent/40"
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

          <div className="flex items-center gap-2">
            <a
              href={`/certificado/${r.id}`}
              aria-label={`Certificado de correção do relatório ${r.titulo}`}
              className="interativo inline-flex items-center justify-center rounded-md border border-borda px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-wider text-texto-2 hover:border-accent hover:text-accent"
            >
              certificado
            </a>
            <Button
              variante="secundaria"
              tamanho="sm"
              onClick={() => abrir(r.id)}
              disabled={abrindo === r.id}
            >
              {abrindo === r.id ? "abrindo..." : "abrir"}
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}

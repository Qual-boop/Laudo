"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { EstadoVazio, ListaSkeleton } from "@/components/verificacao/PainelBase";
import { EquipeRevisaoModal } from "@/components/historico/EquipeRevisaoModal";
import type { RelatorioCompartilhado } from "@/lib/equipe";
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
  const [compartilhados, setCompartilhados] = useState<RelatorioCompartilhado[]>([]);
  const [equipeDe, setEquipeDe] = useState<{ id: number; titulo: string } | null>(null);

  useEffect(() => {
    const controlador = new AbortController();
    fetch("/api/v1/compartilhados", { signal: controlador.signal })
      .then((res) => (res.ok ? res.json() : []))
      .then((dados: RelatorioCompartilhado[]) => setCompartilhados(dados))
      .catch(() => {
        // silencioso: a seção só não aparece
      });
    return () => controlador.abort();
  }, []);

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

  const secaoCompartilhados =
    compartilhados.length > 0 ? (
      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-texto-2">compartilhados comigo</h2>
        {compartilhados.map((r) => (
          <article
            key={`c-${r.id}`}
            className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-borda bg-superficie px-5 py-4"
          >
            <div className="min-w-0">
              <span className="font-mono text-[10px] tracking-wider text-accent">#{r.id} · de {r.dono}</span>
              <h3 className="mt-1.5 text-sm font-medium text-texto">{r.cliente}</h3>
              <p className="mt-0.5 font-mono text-[11px] text-texto-2">
                {r.titulo} · {r.data} · {r.total_achados} achado{r.total_achados === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variante="fantasma" tamanho="sm" onClick={() => setEquipeDe({ id: r.id, titulo: r.titulo })}>
                revisão
              </Button>
              <Button variante="secundaria" tamanho="sm" onClick={() => abrir(r.id)} disabled={abrindo === r.id}>
                {abrindo === r.id ? "abrindo..." : "abrir"}
              </Button>
            </div>
          </article>
        ))}
      </section>
    ) : null;

  const modal = equipeDe && (
    <EquipeRevisaoModal relatorioId={equipeDe.id} titulo={equipeDe.titulo} onFechar={() => setEquipeDe(null)} />
  );

  if (lista.length === 0) {
    if (secaoCompartilhados) {
      return (
        <div className="flex flex-col gap-6">
          {secaoCompartilhados}
          {modal}
        </div>
      );
    }
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
          className="interativo brilho-hover flex flex-wrap items-center justify-between gap-4 rounded-xl border border-borda bg-superficie px-5 py-4"
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
            <Button variante="fantasma" tamanho="sm" onClick={() => setEquipeDe({ id: r.id, titulo: r.titulo })}>
              equipe
            </Button>
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
      {secaoCompartilhados && <div className="mt-4">{secaoCompartilhados}</div>}
      {modal}
    </div>
  );
}

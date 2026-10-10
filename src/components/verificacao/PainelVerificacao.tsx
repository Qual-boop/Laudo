"use client";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/Spinner";
import { AchadoVerificacaoCard } from "@/components/verificacao/AchadoVerificacaoCard";
import { DeltaRelatorio } from "@/components/verificacao/DeltaRelatorio";
import { FormularioReteste } from "@/components/verificacao/FormularioReteste";
import {
  BarraProgresso,
  EstadoVazio,
  ListaSkeleton,
} from "@/components/verificacao/PainelBase";
import { montarDelta } from "@/lib/verificacao";
import type { AchadoVerificavel, DeltaRelatorio as DadosDelta } from "@/lib/tipos";

type Filtro = "todos" | "pendente" | "verificado" | "nao-corrigido";

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: "todos", rotulo: "todos" },
  { id: "pendente", rotulo: "pendentes" },
  { id: "verificado", rotulo: "verificados" },
  { id: "nao-corrigido", rotulo: "não corrigidos" },
];

type Props = {
  onCopiar: (texto: string, rotulo: string) => void;
  onAviso: (texto: string) => void;
  onResumo: (resumo: {
    pendentes: number;
    verificados: number;
    naoCorrigidos: number;
  }) => void;
};

export function PainelVerificacao({ onCopiar, onAviso, onResumo }: Props) {
  const [achados, setAchados] = useState<AchadoVerificavel[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<number | null>(null);
  const [deltaDe, setDeltaDe] = useState<DadosDelta | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const carregar = useCallback(
    async (signal?: AbortSignal, silencioso = false) => {
      if (!silencioso) setCarregando(true);
      try {
        const res = await fetch("/api/verificacao", { signal });
        if (!res.ok) throw new Error("falha");
        const dados = (await res.json()) as AchadoVerificavel[];
        if (signal?.aborted) return;
        setAchados(dados);
        contar(dados);
      } catch (e) {
        // Abort no cleanup (troca de aba / desmontagem) não é erro.
        if (e instanceof DOMException && e.name === "AbortError") return;
        onAviso("Não foi possível carregar os achados verificáveis.");
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

  function contar(lista: AchadoVerificavel[]) {
    onResumo({
      pendentes: lista.filter((a) => a.status === "pendente").length,
      verificados: lista.filter((a) => a.status === "verificado").length,
      naoCorrigidos: lista.filter((a) => a.status === "nao-corrigido").length,
    });
  }

  function aoSalvar(atualizado: AchadoVerificavel) {
    const proxima = achados.map((a) =>
      a.id === atualizado.id ? atualizado : a,
    );
    setAchados(proxima);
    contar(proxima);
    setEditando(null);
    const delta = montarDelta(atualizado);
    if (delta) setDeltaDe(delta);
  }

  const total = achados.length;
  const verificados = achados.filter((a) => a.status === "verificado").length;
  const visiveis =
    filtro === "todos" ? achados : achados.filter((a) => a.status === filtro);
  const certificados = [
    ...new Set(
      achados
        .map((a) => a.relatorio_id)
        .filter((id): id is number => typeof id === "number"),
    ),
  ].sort((a, b) => b - a);

  if (carregando) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2 font-mono text-[11px] text-texto-2">
          <Spinner />
          verificando achados…
        </div>
        <BarraProgresso verificados={0} total={0} />
        <ListaSkeleton linhas={3} />
      </div>
    );
  }

  if (total === 0) {
    return (
      <EstadoVazio
        icone="◷"
        titulo="Nenhum achado para verificar"
        descricao="Os achados entram no painel assim que um relatório é salvo. Gere o relatório na aba “Novo” e clique em “salvar relatório”."
        cta={{ rotulo: "ir para novo", href: "#", onClick: undefined }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <BarraProgresso verificados={verificados} total={total} />

      {total > 0 && verificados === total && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-accent/40 bg-accent/10 px-5 py-4">
          <p className="text-sm text-texto">
            Ciclo concluído — todos os achados foram verificados. Emita o
            certificado de correção.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {certificados.map((id) => (
              <a
                key={id}
                href={`/certificado/${id}`}
                aria-label={`Abrir certificado de correção do relatório ${id}`}
                className="interativo inline-flex items-center justify-center rounded-md border border-accent px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-wider text-accent hover:bg-accent hover:text-fundo"
              >
                certificado #{id}
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 font-mono text-[10px] uppercase tracking-widest text-texto-2">
          filtro
        </span>
        {FILTROS.map((f) => {
          const n =
            f.id === "todos" ? total : achados.filter((a) => a.status === f.id).length;
          const ativo = filtro === f.id;

          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltro(f.id)}
              aria-pressed={ativo}
              className={`interativo cursor-pointer rounded-sm border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${
                ativo
                  ? "border-accent text-accent"
                  : "border-borda text-texto-2 hover:border-texto-2/50 hover:text-texto"
              }`}
            >
              {f.rotulo}
              <span className="ml-1.5 opacity-60">{n}</span>
            </button>
          );
        })}
      </div>

      {deltaDe && (
        <DeltaRelatorio delta={deltaDe} onFechar={() => setDeltaDe(null)} />
      )}

      {visiveis.length === 0 ? (
        <EstadoVazio
          icone="⌕"
          titulo="Nada com esse filtro"
          descricao="Nenhum achado está neste estado no momento."
        />
      ) : (
        visiveis.map((achado) =>
          editando === achado.id ? (
            <FormularioReteste
              key={achado.id}
              achado={achado}
              onCancelar={() => setEditando(null)}
              onSalvo={aoSalvar}
              onAviso={onAviso}
            />
          ) : (
            <AchadoVerificacaoCard
              key={achado.id}
              achado={achado}
              onCopiar={onCopiar}
              onRegistrar={(a) => {
                setDeltaDe(null);
                setEditando(a.id);
              }}
              onVerDelta={(a) => setDeltaDe(montarDelta(a))}
            />
          ),
        )
      )}
    </div>
  );
}

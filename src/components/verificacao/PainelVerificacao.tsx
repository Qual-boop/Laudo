"use client";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/Spinner";
import { AchadoVerificacaoCard } from "@/components/verificacao/AchadoVerificacaoCard";
import { DeltaRelatorio } from "@/components/verificacao/DeltaRelatorio";
import type { Plano } from "@/lib/planos";
import { FormularioReteste } from "@/components/verificacao/FormularioReteste";
import {
  BarraProgresso,
  EstadoVazio,
  ListaSkeleton,
} from "@/components/verificacao/PainelBase";
import { calcularMetricas, estaAtrasado } from "@/lib/metricas";
import { montarDelta } from "@/lib/verificacao";
import type { AchadoVerificavel, DeltaRelatorio as DadosDelta, Severidade } from "@/lib/tipos";

type Filtro = "todos" | "pendente" | "verificado" | "nao-corrigido" | "atrasado";

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: "todos", rotulo: "todos" },
  { id: "pendente", rotulo: "pendentes" },
  { id: "verificado", rotulo: "verificados" },
  { id: "nao-corrigido", rotulo: "não corrigidos" },
  { id: "atrasado", rotulo: "atrasados" },
];

function filtrar(lista: AchadoVerificavel[], filtro: Filtro): AchadoVerificavel[] {
  if (filtro === "todos") return lista;
  if (filtro === "atrasado") return lista.filter((a) => estaAtrasado(a));
  return lista.filter((a) => a.status === filtro);
}

const COR_SEVERIDADE: Record<Severidade, string> = {
  Critica: "bg-critica",
  Alta: "bg-alta",
  Media: "bg-media",
  Baixa: "bg-baixa",
};

function Indicador({ rotulo, valor, detalhe, alerta }: { rotulo: string; valor: string; detalhe?: string; alerta?: boolean }) {
  return (
    <div className={`rounded-md border px-4 py-3 ${alerta ? "border-critica/40 bg-critica/[0.06]" : "border-borda bg-superficie"}`}>
      <p className="font-mono text-[10px] uppercase tracking-widest text-texto-2">{rotulo}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight ${alerta ? "text-critica" : "text-texto"}`}>{valor}</p>
      {detalhe && <p className="mt-0.5 text-[11px] text-texto-2">{detalhe}</p>}
    </div>
  );
}

type Props = {
  onCopiar: (texto: string, rotulo: string) => void;
  onAviso: (texto: string) => void;
  onResumo: (resumo: {
    pendentes: number;
    verificados: number;
    naoCorrigidos: number;
  }) => void;
  plano?: Plano;
};

export function PainelVerificacao({ onCopiar, onAviso, onResumo, plano = "free" }: Props) {
  const [achados, setAchados] = useState<AchadoVerificavel[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<number | null>(null);
  const [deltaDe, setDeltaDe] = useState<DadosDelta | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const carregar = useCallback(
    async (signal?: AbortSignal, silencioso = false) => {
      if (!silencioso) setCarregando(true);
      try {
        const res = await fetch("/api/v1/verificacao", { signal });
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
  const visiveis = filtrar(achados, filtro);
  const metricas = calcularMetricas(achados);
  const severidadesAbertas = (Object.keys(metricas.abertosPorSeveridade) as Severidade[]).filter(
    (s) => metricas.abertosPorSeveridade[s] > 0,
  );
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

      {/* Indicadores para a reunião de acompanhamento. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador
          rotulo="taxa de correção"
          valor={`${metricas.taxaCorrecao}%`}
          detalhe={`${metricas.verificados} de ${metricas.total} verificados`}
        />
        <Indicador
          rotulo="tempo médio de correção"
          valor={
            metricas.tempoMedioCorrecaoDias === null
              ? "—"
              : `${metricas.tempoMedioCorrecaoDias.toLocaleString("pt-BR")} dia${metricas.tempoMedioCorrecaoDias === 1 ? "" : "s"}`
          }
          detalhe="da entrega ao reteste que comprovou"
        />
        <Indicador
          rotulo="em atraso"
          valor={String(metricas.atrasados)}
          detalhe={metricas.venceLogo ? `${metricas.venceLogo} vence${metricas.venceLogo === 1 ? "" : "m"} em breve` : "prazo por severidade"}
          alerta={metricas.atrasados > 0}
        />
        <div className="rounded-md border border-borda bg-superficie px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-texto-2">abertos por severidade</p>
          {severidadesAbertas.length === 0 ? (
            <p className="mt-1 text-2xl font-semibold tracking-tight text-accent">0</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1">
              {severidadesAbertas.map((s) => (
                <li key={s} className="flex items-center gap-2 font-mono text-[11px] text-texto-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${COR_SEVERIDADE[s]}`} />
                  {s === "Critica" ? "crítica" : s === "Media" ? "média" : s.toLowerCase()}
                  <span className="ml-auto text-texto">{metricas.abertosPorSeveridade[s]}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Documentos por relatório: quadro de conformidade e agenda (.ics). */}
      {certificados.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
          <span className="text-texto-2">documentos</span>
          {plano === "free" ? (
            <a href="/precos" className="rounded-sm border border-borda px-2 py-1 text-texto-2 hover:border-accent hover:text-accent">
              quadro de conformidade e agenda de retestes: planos pro e team →
            </a>
          ) : (
            <>
              {certificados.map((id) => (
                <span key={id} className="inline-flex items-center gap-1.5 rounded-sm border border-borda px-2 py-1 text-texto-2">
                  #{id}
                  <a href={`/conformidade/${id}`} className="text-accent hover:underline">
                    conformidade
                  </a>
                  <span aria-hidden="true">·</span>
                  <a href={`/api/v1/agenda?relatorio=${id}`} className="text-accent hover:underline">
                    agenda .ics
                  </a>
                </span>
              ))}
              {certificados.length > 1 && (
                <a href="/api/v1/agenda" className="rounded-sm border border-borda px-2 py-1 text-accent hover:border-accent">
                  agenda completa .ics
                </a>
              )}
            </>
          )}
        </div>
      )}

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
          const n = filtrar(achados, f.id).length;
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
              onAviso={onAviso}
              plano={plano}
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

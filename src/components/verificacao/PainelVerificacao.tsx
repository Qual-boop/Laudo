"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/Alert";
import { Card } from "@/components/Card";
import { Spinner } from "@/components/Spinner";
import { AchadoVerificacaoCard } from "@/components/verificacao/AchadoVerificacaoCard";
import { DeltaRelatorio } from "@/components/verificacao/DeltaRelatorio";
import { FormularioReteste } from "@/components/verificacao/FormularioReteste";
import { BarraProgresso } from "@/components/verificacao/PainelBase";
import { montarDelta } from "@/lib/verificacao";
import type { AchadoVerificavel, DeltaRelatorio as DadosDelta } from "@/lib/tipos";

type Filtro = "todos" | "pendente" | "verificado" | "nao-corrigido";

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: "todos", rotulo: "todos" },
  { id: "pendente", rotulo: "pendentes" },
  { id: "verificado", rotulo: "verificados" },
  { id: "nao-corrigido", rotulo: "não corrigidos" },
];

export function PainelVerificacao() {
  const [achados, setAchados] = useState<AchadoVerificavel[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<number | null>(null);
  const [deltaDe, setDeltaDe] = useState<DadosDelta | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/verificacao");
      if (!res.ok) throw new Error("falha");
      setAchados((await res.json()) as AchadoVerificavel[]);
      setErro(null);
    } catch {
      setErro("Não foi possível carregar os achados verificáveis.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function aoSalvar(atualizado: AchadoVerificavel) {
    setAchados((atuais) => atuais.map((a) => (a.id === atualizado.id ? atualizado : a)));
    setEditando(null);

    const delta = montarDelta(atualizado);
    if (delta) setDeltaDe(delta);
  }

  const total = achados.length;
  const verificados = achados.filter((a) => a.status === "verificado").length;
  const visiveis = filtro === "todos" ? achados : achados.filter((a) => a.status === filtro);

  if (carregando) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-md border border-dashed border-borda px-6 py-16 font-mono text-xs text-texto-2">
        <Spinner />
        carregando achados…
      </div>
    );
  }

  if (total === 0) {
    return (
      <Card className="px-6 py-14 text-center">
        <p className="font-mono text-xs text-texto-2">
          nenhum achado para verificar
          <span className="animate-blink text-accent"> ▋</span>
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-texto-2/70">
          Os achados entram no painel assim que um relatório é salvo. Vá para a
          aba “Novo”, gere o relatório e clique em “salvar relatório”.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {erro && <Alert tom="erro">{erro}</Alert>}

      <BarraProgresso verificados={verificados} total={total} />

      <div className="no-print flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
          filtro
        </span>
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            className={`cursor-pointer rounded-sm border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors duration-200 ${
              filtro === f.id
                ? "border-accent text-accent"
                : "border-borda text-texto-2 hover:border-texto-2/50 hover:text-texto"
            }`}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      {deltaDe && (
        <DeltaRelatorio delta={deltaDe} onFechar={() => setDeltaDe(null)} />
      )}

      {visiveis.length === 0 ? (
        <Card className="px-6 py-10 text-center text-sm text-texto-2">
          Nenhum achado com esse status.
        </Card>
      ) : (
        visiveis.map((achado) =>
          editando === achado.id ? (
            <FormularioReteste
              key={achado.id}
              achado={achado}
              onCancelar={() => setEditando(null)}
              onSalvo={aoSalvar}
            />
          ) : (
            <AchadoVerificacaoCard
              key={achado.id}
              achado={achado}
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

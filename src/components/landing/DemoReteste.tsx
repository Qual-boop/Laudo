"use client";

import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { Icone } from "@/components/landing/Icone";
import { CERTIFICADO_EXEMPLO, HASH_EXEMPLO } from "@/lib/certificado-exemplo";

/*
 * Demonstração interativa do hero: o visitante registra o último reteste
 * e vê o ciclo fechar — achado verificado, barra a 100%, selo carimbado.
 * É a sensação que o produto entrega, em 2 segundos e um clique.
 *
 * Sem JS (ou antes de hidratar) a cena já é legível: 2 de 3 verificados
 * e o certificado "aguardando". Com prefers-reduced-motion, sem animação.
 */

type Fase = "pendente" | "retestando" | "verificado";

const COR_SEVERIDADE = {
  Critica: ["Crítica", "text-critica"],
  Alta: ["Alta", "text-alta"],
  Media: ["Média", "text-media"],
  Baixa: ["Baixa", "text-baixa"],
} as const;

/** 8 blocos de 8 hex, como no certificado (sem importar node:crypto no cliente). */
const BLOCOS_HASH = HASH_EXEMPLO.match(/.{1,8}/g) ?? [];

function dataCurta(iso: string) {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

export function DemoReteste() {
  const { relatorio, achados, emitidoEm } = CERTIFICADO_EXEMPLO;
  const [fase, setFase] = useState<Fase>("pendente");
  const [tentativas, setTentativas] = useState(0);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current);
  }, []);

  const ultimo = achados.length - 1;
  const verificados = fase === "verificado" ? achados.length : achados.length - 1;
  const percentual = Math.round((verificados / achados.length) * 100);
  const [ano, mes, dia] = emitidoEm.split("-");

  function retestar() {
    if (fase !== "pendente") return;
    setFase("retestando");
    setTentativas((n) => n + 1);
    temporizador.current = setTimeout(() => setFase("verificado"), 900);
  }

  function recomecar() {
    setFase("pendente");
  }

  return (
    <div className="relative mx-auto w-full max-w-[34rem] pb-28 lg:mx-0 lg:ml-auto">
      <div aria-hidden="true" className="lp-aura absolute -inset-8 -z-10" />

      <figure className="lp-painel overflow-hidden rounded-2xl" aria-label="Demonstração: registre o último reteste">
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-3.5">
          <span aria-hidden="true" className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
          </span>
          <span className="truncate font-mono text-[11px] text-texto-2">
            acme · pentest web · v{relatorio.versao}
          </span>
          <span
            className={`ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] transition-colors duration-500 ${
              fase === "verificado" ? "bg-accent/[0.12] text-accent" : "bg-media/[0.12] text-media"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${fase === "verificado" ? "bg-accent" : "bg-media lp-pulsar"}`} />
            {fase === "verificado" ? "ciclo fechado" : "1 reteste pendente"}
          </span>
        </div>

        <div className="px-5 pb-4 pt-5">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium text-texto" aria-live="polite">
              {verificados} de {achados.length} achados verificados
            </p>
            <p className={`font-mono text-xs transition-colors duration-500 ${fase === "verificado" ? "text-accent" : "text-texto-2"}`}>
              {percentual}%
            </p>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out"
              style={{ width: `${percentual}%` }}
            />
          </div>

          <ul className="mt-4 divide-y divide-white/[0.06]">
            {achados.map((a, i) => {
              const [rotulo, cor] = COR_SEVERIDADE[a.severidade];
              const ehUltimo = i === ultimo;
              const ok = !ehUltimo || fase === "verificado";
              return (
                <li key={a.ref} className="flex items-center gap-3 py-3">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${
                      ok ? "bg-accent/[0.12] text-accent" : "border border-dashed border-media/50 text-media"
                    } ${ehUltimo && fase === "verificado" ? "lp-estalo" : ""}`}
                  >
                    {ok ? <Icone nome="check" className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-media" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-texto">{a.titulo}</p>
                    <p className="font-mono text-[11px] text-texto-2">
                      {a.ref} · <span className={cor}>{rotulo}</span>
                    </p>
                  </div>
                  {ehUltimo && fase !== "verificado" ? (
                    <button
                      type="button"
                      onClick={retestar}
                      disabled={fase === "retestando"}
                      className="lp-btn-primario lp-btn-pequeno lp-chamar shrink-0 cursor-pointer disabled:cursor-wait"
                    >
                      {fase === "retestando" ? (
                        <>
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#03130b]/30 border-t-[#03130b]" />
                          retestando
                        </>
                      ) : (
                        "Retestar"
                      )}
                    </button>
                  ) : (
                    a.dataReteste && (
                      <span className="hidden shrink-0 font-mono text-[11px] text-texto-2 sm:block">
                        reteste {dataCurta(a.dataReteste)}
                      </span>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </figure>

      {/* O certificado: aguardando → carimbado quando o ciclo fecha. */}
      <div
        className={`lp-flutuar lp-papel absolute -bottom-4 right-3 w-60 rotate-[-2.5deg] rounded-lg p-4 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.85)] transition-[filter,opacity] duration-500 sm:-right-6 sm:w-64 ${
          fase === "verificado" ? "" : "opacity-90 grayscale-[0.6]"
        }`}
      >
        <div className="flex items-center gap-2">
          <Logo className="h-5 w-5 text-[#047857]" />
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#475569]">
            certificado de correção
          </span>
        </div>
        <p className="mt-2.5 font-serif text-[1.35rem] leading-tight text-[#0f172a]">
          {relatorio.cliente.replace(" Ltda.", "")}
        </p>
        <p className="mt-0.5 text-[11px] text-[#475569]">
          {fase === "verificado"
            ? `${achados.length}/${achados.length} achados corrigidos · ${dia}/${mes}/${ano}`
            : `aguardando 1 reteste`}
        </p>
        <p className="mt-3 font-mono text-[9.5px] leading-relaxed text-[#047857]">
          {fase === "verificado" ? `sha-256 ${BLOCOS_HASH.slice(0, 3).join(" ")}…` : "sha-256 —"}
        </p>
        {fase === "verificado" && (
          <span
            key={tentativas}
            aria-hidden="true"
            className="lp-carimbo absolute -right-3 -top-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#047857] bg-[#f7f5ef] text-[#047857] shadow-md"
          >
            <span className="text-center font-mono text-[8px] font-bold uppercase leading-tight tracking-wider">
              100%
              <br />
              verificado
            </span>
          </span>
        )}
      </div>

      <p className="absolute bottom-6 left-1 max-w-[52%] text-left text-xs leading-relaxed text-texto-2" aria-live="polite">
        {fase === "verificado" ? (
          <>
            Ciclo fechado. É isso que o seu cliente recebe.{" "}
            <button type="button" onClick={recomecar} className="cursor-pointer text-accent underline-offset-4 hover:underline">
              de novo
            </button>
          </>
        ) : (
          "Experimente: registre o último reteste."
        )}
      </p>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/Button";
import { Select } from "@/components/Field";
import { Spinner } from "@/components/Spinner";
import { STACKS, kitEmMarkdown, type KitCorrecao, type Stack } from "@/lib/kit-correcao";
import type { AchadoVerificavel } from "@/lib/tipos";

type Props = {
  achado: AchadoVerificavel;
  onFechar: () => void;
  onCopiar: (texto: string, rotulo: string) => void;
};

const STACK_SALVA = "laudo:kit-stack";

function stackInicial(): Stack {
  try {
    const s = localStorage.getItem(STACK_SALVA);
    if (s && s in STACKS) return s as Stack;
  } catch {
    // sem storage: usa o padrão
  }
  return "node";
}

function Bloco({
  titulo,
  conteudo,
  onCopiar,
  rotuloCopia,
}: {
  titulo: string;
  conteudo: string;
  onCopiar: Props["onCopiar"];
  rotuloCopia: string;
}) {
  if (!conteudo) return null;
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-texto-2">{titulo}</h3>
        <button
          type="button"
          onClick={() => onCopiar(conteudo, rotuloCopia)}
          className="interativo cursor-pointer rounded-sm border border-borda px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-texto-2 hover:border-accent hover:text-accent"
        >
          copiar
        </button>
      </div>
      <pre className="max-h-72 overflow-auto rounded-md border border-borda bg-fundo p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre text-texto/90">
        {conteudo}
      </pre>
    </section>
  );
}

/** Kit de correção para o time de dev, gerado sob demanda por achado. */
export function KitCorrecaoModal({ achado, onFechar, onCopiar }: Props) {
  const [stack, setStack] = useState<Stack>("node");
  const [kit, setKit] = useState<KitCorrecao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const painel = useRef<HTMLDivElement>(null);
  // Ref: o pai passa uma função nova a cada render; o efeito roda uma vez só.
  const fechar = useRef(onFechar);
  fechar.current = onFechar;

  useEffect(() => {
    setStack(stackInicial());
    painel.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar.current();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  async function gerar() {
    setCarregando(true);
    setErro(null);
    try {
      localStorage.setItem(STACK_SALVA, stack);
    } catch {
      // opcional
    }
    try {
      const res = await fetch("/api/v1/kit-correcao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ achadoId: achado.id, stack }),
      });
      const corpo = await res.json().catch(() => null);
      if (!res.ok) {
        setErro(corpo?.error ?? "Não foi possível gerar o kit agora.");
        return;
      }
      setKit(corpo as KitCorrecao);
    } catch {
      setErro("Não foi possível conectar ao servidor.");
    } finally {
      setCarregando(false);
    }
  }

  // Portal: o cartão do achado tem transform no hover, que viraria o
  // "containing block" do position:fixed e prenderia o modal dentro dele.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kit-titulo"
        tabIndex={-1}
        className="w-full max-w-3xl rounded-xl border border-borda bg-superficie shadow-2xl outline-none"
      >
        <header className="flex items-start justify-between gap-4 border-b border-borda px-5 py-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-widest text-accent">
              kit de correção · {achado.achado_ref}
            </p>
            <h2 id="kit-titulo" className="mt-1 text-base font-semibold leading-snug text-texto">
              {achado.titulo}
            </h2>
            <p className="mt-1 text-xs text-texto-2">
              Para o time de dev: código antes × depois, teste automatizado e comando de reteste.
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="cursor-pointer rounded-sm px-2 py-1 font-mono text-sm text-texto-2 hover:text-texto"
          >
            ✕
          </button>
        </header>

        <div className="flex flex-col gap-3 border-b border-borda px-5 py-4 sm:flex-row sm:items-center">
          <label htmlFor="kit-stack" className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
            stack do cliente
          </label>
          <Select
            id="kit-stack"
            className="font-mono text-xs sm:max-w-xs"
            value={stack}
            onChange={(e) => {
              setStack(e.target.value as Stack);
              setKit(null);
            }}
          >
            {(Object.keys(STACKS) as Stack[]).map((s) => (
              <option key={s} value={s}>
                {STACKS[s].rotulo}
              </option>
            ))}
          </Select>
          <Button variante="primaria" tamanho="sm" onClick={gerar} disabled={carregando} className="sm:ml-auto">
            {carregando ? (
              <>
                <Spinner /> gerando kit…
              </>
            ) : kit ? (
              "gerar de novo"
            ) : (
              "gerar kit"
            )}
          </Button>
        </div>

        <div className="flex flex-col gap-5 px-5 py-5">
          {erro && (
            <p role="alert" className="font-mono text-xs text-critica">
              {erro}
            </p>
          )}

          {!kit && !carregando && !erro && (
            <p className="text-sm leading-relaxed text-texto-2">
              Escolha a stack e gere o kit. Os dados do cliente passam pelo Escudo de privacidade
              antes da IA. O código é ilustrativo do padrão de correção — adapte ao projeto.
            </p>
          )}

          {kit && (
            <>
              {kit.origem === "local" && (
                <p className="rounded-md border border-media/40 bg-media/10 px-3 py-2 text-xs text-media">
                  IA indisponível agora: kit básico com checklist e reteste. Gere de novo em instantes
                  para o código.
                </p>
              )}
              <section>
                <h3 className="font-mono text-[10px] uppercase tracking-widest text-texto-2">o que corrigir</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-texto">{kit.resumo}</p>
              </section>
              <section>
                <h3 className="font-mono text-[10px] uppercase tracking-widest text-texto-2">causa raiz</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-texto-2">{kit.causaRaiz}</p>
              </section>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Bloco
                  titulo="antes · vulnerável"
                  conteudo={kit.codigoVulneravel}
                  onCopiar={onCopiar}
                  rotuloCopia="Código vulnerável copiado"
                />
                <Bloco
                  titulo="depois · corrigido"
                  conteudo={kit.codigoCorrigido}
                  onCopiar={onCopiar}
                  rotuloCopia="Código corrigido copiado"
                />
              </div>
              <Bloco
                titulo={`teste automatizado · ${STACKS[kit.stack].testes}`}
                conteudo={kit.testeAutomatizado}
                onCopiar={onCopiar}
                rotuloCopia="Teste copiado"
              />
              {kit.reteste.comando && (
                <div className="flex flex-col gap-2">
                  <Bloco
                    titulo="reteste"
                    conteudo={kit.reteste.comando}
                    onCopiar={onCopiar}
                    rotuloCopia="Comando de reteste copiado"
                  />
                  <p className="text-xs leading-relaxed text-texto-2">{kit.reteste.descricao}</p>
                </div>
              )}
              <section>
                <h3 className="font-mono text-[10px] uppercase tracking-widest text-texto-2">checklist</h3>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {kit.checklist.map((c) => (
                    <li key={c} className="flex gap-2 text-sm text-texto-2">
                      <span aria-hidden="true" className="font-mono text-accent">
                        ☐
                      </span>
                      {c}
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h3 className="font-mono text-[10px] uppercase tracking-widest text-texto-2">referências</h3>
                <ul className="mt-2 flex flex-col gap-1">
                  {kit.referencias.map((r) => (
                    <li key={r} className="truncate font-mono text-[11px]">
                      <a href={r} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                        {r}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>

        {kit && (
          <footer className="flex flex-col gap-2 border-t border-borda px-5 py-4 sm:flex-row sm:justify-end">
            <Button
              variante="secundaria"
              tamanho="sm"
              onClick={() => onCopiar(kitEmMarkdown(kit, achado.titulo), "Kit copiado em Markdown")}
            >
              copiar como issue/PR (markdown)
            </Button>
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

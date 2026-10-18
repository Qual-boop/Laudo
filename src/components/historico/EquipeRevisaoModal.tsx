"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/Button";
import { Select } from "@/components/Field";
import { Spinner } from "@/components/Spinner";
import type { Comentario, EquipeRelatorio } from "@/lib/equipe";
import type { Relatorio } from "@/lib/tipos";

type Props = {
  relatorioId: number;
  titulo: string;
  onFechar: () => void;
};

function quando(iso: string): string {
  const d = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso.replace(" ", "T")}Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Equipe (quem revisa) + fio de revisão por achado. */
export function EquipeRevisaoModal({ relatorioId, titulo, onFechar }: Props) {
  const [equipe, setEquipe] = useState<EquipeRelatorio | null>(null);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [achados, setAchados] = useState<{ id: string; titulo: string }[]>([]);
  const [email, setEmail] = useState("");
  const [texto, setTexto] = useState("");
  const [achadoRef, setAchadoRef] = useState("");
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const fechar = useRef(onFechar);
  fechar.current = onFechar;

  const carregar = useCallback(async () => {
    const [e, c, r] = await Promise.all([
      fetch(`/api/v1/relatorios/${relatorioId}/equipe`),
      fetch(`/api/v1/relatorios/${relatorioId}/comentarios`),
      fetch(`/api/v1/relatorios/${relatorioId}`),
    ]);
    if (e.ok) setEquipe((await e.json()) as EquipeRelatorio);
    if (c.ok) setComentarios((await c.json()) as Comentario[]);
    if (r.ok) {
      const rel = (await r.json()) as Relatorio;
      setAchados((rel.achados ?? []).map((a) => ({ id: a.id, titulo: a.titulo })));
    }
  }, [relatorioId]);

  useEffect(() => {
    void carregar();
    const aoTeclar = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") fechar.current();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [carregar]);

  async function compartilhar() {
    setOcupado(true);
    setMensagem(null);
    try {
      const res = await fetch(`/api/v1/relatorios/${relatorioId}/equipe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const corpo = await res.json().catch(() => null);
      if (!res.ok) {
        setMensagem({ tipo: "erro", texto: corpo?.error ?? "Não foi possível compartilhar." });
        return;
      }
      setEmail("");
      setMensagem({ tipo: "ok", texto: corpo.mensagem });
      await carregar();
    } finally {
      setOcupado(false);
    }
  }

  async function remover(usuarioId: number) {
    const res = await fetch(`/api/v1/relatorios/${relatorioId}/equipe?usuarioId=${usuarioId}`, { method: "DELETE" });
    if (res.ok) await carregar();
  }

  async function comentar() {
    if (!texto.trim()) return;
    setOcupado(true);
    try {
      const res = await fetch(`/api/v1/relatorios/${relatorioId}/comentarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto, achadoRef: achadoRef || undefined }),
      });
      const corpo = await res.json().catch(() => null);
      if (!res.ok) {
        setMensagem({ tipo: "erro", texto: corpo?.error ?? "Não foi possível comentar." });
        return;
      }
      setComentarios(corpo as Comentario[]);
      setTexto("");
    } finally {
      setOcupado(false);
    }
  }

  const ehDono = equipe?.papel === "dono";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onFechar();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="equipe-titulo" className="w-full max-w-2xl rounded-xl border border-borda bg-superficie shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-borda px-5 py-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-widest text-accent">equipe e revisão · #{relatorioId}</p>
            <h2 id="equipe-titulo" className="mt-1 truncate text-base font-semibold text-texto">{titulo}</h2>
            {equipe && (
              <p className="mt-1 text-xs text-texto-2">
                {ehDono ? "Você é o dono." : `Compartilhado por ${equipe.dono}. Você revisa e comenta.`}
              </p>
            )}
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="cursor-pointer px-2 py-1 font-mono text-sm text-texto-2 hover:text-texto">
            ✕
          </button>
        </header>

        {!equipe ? (
          <p className="flex items-center gap-2 px-5 py-6 font-mono text-xs text-texto-2">
            <Spinner /> carregando…
          </p>
        ) : (
          <div className="flex flex-col gap-6 px-5 py-5">
            <section>
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
                revisores {ehDono && `(${equipe.membros.length}/${equipe.limite})`}
              </h3>
              {equipe.membros.length === 0 ? (
                <p className="mt-2 text-sm text-texto-2">Ninguém além do dono ainda.</p>
              ) : (
                <ul className="mt-2 flex flex-col divide-y divide-borda rounded-md border border-borda">
                  {equipe.membros.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="text-texto">{m.nome}</span>
                      {m.email && <span className="truncate font-mono text-[11px] text-texto-2">{m.email}</span>}
                      {ehDono && (
                        <button type="button" onClick={() => remover(m.id)} className="ml-auto cursor-pointer font-mono text-[10px] uppercase tracking-wider text-texto-2 hover:text-critica">
                          remover
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {ehDono && (
                <form
                  className="mt-3 flex flex-col gap-2 sm:flex-row"
                  onSubmit={(ev) => {
                    ev.preventDefault();
                    void compartilhar();
                  }}
                >
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(ev) => setEmail(ev.target.value)}
                    placeholder="e-mail do colega com conta no Provafix"
                    aria-label="E-mail do colega"
                    className="flex-1 rounded-md border border-borda bg-fundo px-3 py-2 text-sm text-texto placeholder:text-texto-2/50"
                  />
                  <Button type="submit" variante="primaria" tamanho="sm" disabled={ocupado || equipe.limite === 0}>
                    compartilhar
                  </Button>
                </form>
              )}
              {ehDono && equipe.limite === 0 && (
                <p className="mt-2 text-xs text-texto-2">
                  Compartilhar é dos planos Pro (1 colega) e Team (até 10).{" "}
                  <a href="/precos" className="text-accent hover:underline">ver planos</a>
                </p>
              )}
            </section>

            <section>
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-texto-2">revisão</h3>
              <ul className="mt-2 flex max-h-72 flex-col gap-2 overflow-y-auto">
                {comentarios.length === 0 && <li className="text-sm text-texto-2">Sem comentários ainda.</li>}
                {comentarios.map((c) => (
                  <li key={c.id} className={`rounded-md border px-3 py-2 ${c.meu ? "border-accent/30 bg-accent/[0.04]" : "border-borda"}`}>
                    <p className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-texto-2">
                      <span className="text-texto">{c.autor}</span>
                      {c.achadoRef && <span className="rounded-sm border border-borda px-1.5 text-accent">{c.achadoRef}</span>}
                      <span>{quando(c.criadoEm)}</span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-texto">{c.texto}</p>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-col gap-2">
                <Select aria-label="Sobre qual achado" className="font-mono text-xs" value={achadoRef} onChange={(ev) => setAchadoRef(ev.target.value)}>
                  <option value="">relatório inteiro</option>
                  {achados.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.id} · {a.titulo}
                    </option>
                  ))}
                </Select>
                <textarea
                  value={texto}
                  maxLength={2000}
                  onChange={(ev) => setTexto(ev.target.value)}
                  rows={3}
                  placeholder="Ex.: o CVSS do FINDING-002 deveria considerar PR:L — o endpoint exige login."
                  aria-label="Comentário de revisão"
                  className="w-full rounded-md border border-borda bg-fundo px-3 py-2 text-sm text-texto placeholder:text-texto-2/50"
                />
                <Button variante="secundaria" tamanho="sm" onClick={comentar} disabled={ocupado || !texto.trim()} className="self-end">
                  comentar
                </Button>
              </div>
            </section>

            {mensagem && (
              <p role={mensagem.tipo === "erro" ? "alert" : "status"} className={`font-mono text-xs ${mensagem.tipo === "erro" ? "text-critica" : "text-accent"}`}>
                {mensagem.texto}
              </p>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

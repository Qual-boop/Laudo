"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/Button";
import { copiarParaClipboard } from "@/lib/exportacao";

const semAssinatura = () => () => {};

type Props = {
  hash: string;
  /** Só na página do dono: o link público (`/c/<token>`) e o relatório dele. */
  linkPublico?: { relatorioId: number; token: string | null };
};

type Estado = "ocioso" | "hash" | "link" | "trabalhando" | "erro";

/**
 * Copiar hash e imprimir; na página do dono, também copiar e revogar o link
 * público. São as únicas ações que precisam de JS no cliente.
 */
export function AcoesCertificado({ hash, linkPublico }: Props) {
  const [estado, setEstado] = useState<Estado>("ocioso");
  const [token, setToken] = useState(linkPublico?.token ?? null);
  const [erro, setErro] = useState<string | null>(null);

  // Origem só existe no navegador: no SSR o link aparece depois da hidratação.
  const origem = useSyncExternalStore(
    semAssinatura,
    () => window.location.origin,
    () => "",
  );
  const url = token && origem ? `${origem}/c/${token}` : null;

  // Um timer só, limpo ao trocar e ao desmontar (F13).
  const temporizador = useRef<number | null>(null);
  useEffect(() => () => {
    if (temporizador.current) window.clearTimeout(temporizador.current);
  }, []);

  function avisar(novo: Estado) {
    setEstado(novo);
    if (temporizador.current) window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => setEstado("ocioso"), 2500);
  }

  async function copiarTexto(texto: string): Promise<boolean> {
    try {
      // Com fallback para http (execCommand) — F14.
      await copiarParaClipboard(texto);
      return true;
    } catch {
      // Sem nenhum caminho de cópia: hash e link seguem visíveis na tela
      // para copiar à mão.
      return false;
    }
  }

  async function copiarHash() {
    if (await copiarTexto(hash)) avisar("hash");
  }

  async function copiarLink() {
    if (!linkPublico) return;
    setErro(null);
    let atual = token;

    if (!atual) {
      setEstado("trabalhando");
      try {
        const res = await fetch(`/api/v1/certificado/${linkPublico.relatorioId}/link`, {
          method: "POST",
        });
        const corpo = (await res.json()) as { token?: string; error?: string };
        if (!res.ok || !corpo.token) {
          throw new Error(corpo.error ?? "Não foi possível criar o link.");
        }
        atual = corpo.token;
        setToken(atual);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não foi possível criar o link.");
        setEstado("erro");
        return;
      }
    }

    if (await copiarTexto(`${window.location.origin}/c/${atual}`)) avisar("link");
    else setEstado("ocioso");
  }

  async function revogar() {
    if (!linkPublico || !token) return;
    if (
      !window.confirm(
        "Revogar o link público? Quem tiver o endereço atual deixa de abrir o certificado. Um novo link terá outro endereço.",
      )
    ) {
      return;
    }

    setErro(null);
    setEstado("trabalhando");
    try {
      const res = await fetch(`/api/v1/certificado/${linkPublico.relatorioId}/link`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const corpo = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(corpo.error ?? "Não foi possível revogar o link.");
      }
      setToken(null);
      setEstado("ocioso");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível revogar o link.");
      setEstado("erro");
    }
  }

  const trabalhando = estado === "trabalhando";

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {linkPublico && (
          <>
            <Button
              variante="secundaria"
              tamanho="sm"
              onClick={copiarLink}
              disabled={trabalhando}
              aria-label="Copiar o link público do certificado (cria o link se ainda não existir)"
            >
              {estado === "link" ? "link copiado ✓" : "copiar link público"}
            </Button>
            {token && (
              <Button
                variante="fantasma"
                tamanho="sm"
                onClick={revogar}
                disabled={trabalhando}
                aria-label="Revogar o link público do certificado"
              >
                revogar link
              </Button>
            )}
          </>
        )}
        <Button
          variante="secundaria"
          tamanho="sm"
          onClick={copiarHash}
          aria-label="Copiar hash de verificação do certificado"
        >
          {estado === "hash" ? "copiado ✓" : "copiar hash"}
        </Button>
        <Button
          variante="sucesso"
          tamanho="sm"
          onClick={() => window.print()}
          aria-label="Imprimir ou salvar o certificado em PDF"
        >
          imprimir
        </Button>
      </div>

      {linkPublico && url && (
        <p className="max-w-full font-mono text-[10px] break-all text-texto-2">
          link público ativo:{" "}
          <a href={url} className="text-accent hover:underline">
            {url}
          </a>
        </p>
      )}
      {erro && (
        <p role="alert" className="font-mono text-[10px] text-critica">
          {erro}
        </p>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import {
  abrirNovaAbaGitHub,
  abrirNovaAbaJira,
  gerarExportacaoJira,
  gerarExportacaoGitHub,
  copiarParaClipboard,
} from "@/lib/exportacao";
import { LIMITES, type Plano } from "@/lib/planos";
import type { Relatorio } from "@/lib/tipos";

type Props = {
  relatorio: Relatorio;
  jiraBaseUrl?: string;
  githubRepoUrl?: string;
  plano?: Plano;
};

export function AcoesExportacao({ relatorio, jiraBaseUrl, githubRepoUrl, plano = "free" }: Props) {
  const [copiado, setCopiado] = useState<"jira" | "github" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const avancado = LIMITES[plano].exportacaoAvancada;
  // Um timer só, limpo ao trocar e ao desmontar (antes ficavam órfãos).
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current);
  }, []);

  function marcar(qual: "jira" | "github", texto: string | null = null) {
    setCopiado(qual);
    setAviso(texto);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      setCopiado(null);
      setAviso(null);
    }, texto ? 6000 : 2500);
  }

  const exportacaoJira = gerarExportacaoJira(relatorio);
  const exportacaoGitHub = gerarExportacaoGitHub(relatorio);

  async function copiarJira() {
    try {
      await copiarParaClipboard(JSON.stringify(exportacaoJira, null, 2));
      marcar("jira");
    } catch {
      setCopiado(null);
    }
  }

  async function copiarGitHub() {
    try {
      await copiarParaClipboard(exportacaoGitHub.body);
      marcar("github");
    } catch {
      setCopiado(null);
    }
  }

  const AVISO_CORTE = "relatório grande: o link levou um resumo e o texto completo foi copiado — cole na issue";

  // window.open precisa sair direto do clique (o import() dinâmico de antes
  // abria a aba depois de um await e o bloqueador de pop-up barrava).
  async function abrirJira() {
    if (!jiraBaseUrl) return copiarJira();
    const { cortado } = await abrirNovaAbaJira(exportacaoJira, jiraBaseUrl);
    if (cortado) marcar("jira", AVISO_CORTE);
  }

  async function abrirGitHub() {
    if (!githubRepoUrl) return copiarGitHub();
    const { cortado } = await abrirNovaAbaGitHub(exportacaoGitHub, githubRepoUrl);
    if (cortado) marcar("github", AVISO_CORTE);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variante="secundaria"
        tamanho="sm"
        onClick={abrirJira}
        disabled={!avancado}
        title={avancado ? undefined : "Exportação Jira disponível nos planos Pro e Team"}
        aria-label={jiraBaseUrl ? "Abrir no Jira" : "Copiar descrição para Jira (JSON)"}
      >
        {copiado === "jira" ? "copiado ✓" : avancado ? "jira" : "jira 🔒"}
      </Button>
      <Button
        variante="secundaria"
        tamanho="sm"
        onClick={abrirGitHub}
        disabled={!avancado}
        title={avancado ? undefined : "Exportação GitHub disponível nos planos Pro e Team"}
        aria-label={githubRepoUrl ? "Abrir no GitHub" : "Copiar descrição para GitHub (Markdown)"}
      >
        {copiado === "github" ? "copiado ✓" : avancado ? "github" : "github 🔒"}
      </Button>
      <span className="font-mono text-[10px] uppercase tracking-wider text-texto-2/60">
        {jiraBaseUrl ? "configurado" : "sem url"} · {githubRepoUrl ? "configurado" : "sem url"}
      </span>
      {aviso && (
        <p role="status" className="w-full font-mono text-[11px] text-media">
          {aviso}
        </p>
      )}
    </div>
  );
}
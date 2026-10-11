"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import {
  gerarExportacaoJira,
  gerarExportacaoGitHub,
  copiarParaClipboard,
  type ExportacaoJira,
  type ExportacaoGitHub,
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
  const avancado = LIMITES[plano].exportacaoAvancada;

  const exportacaoJira = gerarExportacaoJira(relatorio);
  const exportacaoGitHub = gerarExportacaoGitHub(relatorio);

  async function copiarJira() {
    try {
      await copiarParaClipboard(JSON.stringify(exportacaoJira, null, 2));
      setCopiado("jira");
      setTimeout(() => setCopiado(null), 2500);
    } catch {
      setCopiado(null);
    }
  }

  async function copiarGitHub() {
    try {
      await copiarParaClipboard(exportacaoGitHub.body);
      setCopiado("github");
      setTimeout(() => setCopiado(null), 2500);
    } catch {
      setCopiado(null);
    }
  }

  function abrirJira() {
    if (jiraBaseUrl) {
      import("@/lib/exportacao").then(({ abrirNovaAbaJira }) => abrirNovaAbaJira(exportacaoJira, jiraBaseUrl));
    } else {
      copiarJira();
    }
  }

  function abrirGitHub() {
    if (githubRepoUrl) {
      import("@/lib/exportacao").then(({ abrirNovaAbaGitHub }) => abrirNovaAbaGitHub(exportacaoGitHub, githubRepoUrl));
    } else {
      copiarGitHub();
    }
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
    </div>
  );
}
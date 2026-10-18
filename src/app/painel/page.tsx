"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { Button } from "@/components/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/Card";
import { Field, Input, Select, Textarea } from "@/components/Field";
import { SeverityBadge } from "@/components/SeverityBadge";
import { Spinner } from "@/components/Spinner";
import { RelatorioSkeleton } from "@/components/relatorio/RelatorioSkeleton";
import { Header } from "@/components/Header";
import { LayoutComSidebar, type ResumoGeral } from "@/components/LayoutComSidebar";
import { ToastViewport, useToast } from "@/components/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  PaywallModal,
  dispararPaywall,
  usePaywall,
} from "@/components/PaywallModal";
import { ROTULO_TIPO, lerResumoProtecao } from "@/lib/anonimizacao";
import { BIBLIOTECA, CATEGORIAS, achadoDoModelo } from "@/lib/biblioteca-achados";
// Só o tipo: o parser XML fica no servidor, fora do bundle do cliente.
import type { FormatoScanner, ResultadoImportacao } from "@/lib/importacao";

const NOME_SCANNER: Record<FormatoScanner, string> = {
  nessus: "Nessus",
  burp: "Burp Suite",
  zap: "OWASP ZAP",
  sarif: "SARIF",
};

/** Mesmo teto do esquema de geração (lib/validacao.ts). */
const LIMITE_ACHADOS_FORM = 50;
const LIMITE_IMPORTACAO_BYTES = 15 * 1024 * 1024;

// Componentes pesados carregados sob demanda (code splitting).
// `ssr: false` porque todos dependem de APIs do browser ou de estado
// interativo que só faz sentido no cliente.
const Onboarding = dynamic(
  () => import("@/components/Onboarding").then((mod) => mod.Onboarding),
  { ssr: false },
);
const PainelHistorico = dynamic(
  () =>
    import("@/components/historico/PainelHistorico").then(
      (mod) => mod.PainelHistorico,
    ),
  {
    ssr: false,
    loading: () => (
      <p className="font-mono text-xs text-texto-2">carregando histórico…</p>
    ),
  },
);
const PainelVerificacao = dynamic(
  () =>
    import("@/components/verificacao/PainelVerificacao").then(
      (mod) => mod.PainelVerificacao,
    ),
  {
    ssr: false,
    loading: () => (
      <p className="font-mono text-xs text-texto-2">carregando verificação…</p>
    ),
  },
);
const AcoesExportacao = dynamic(
  () =>
    import("@/components/exportacao/AcoesExportacao").then(
      (mod) => mod.AcoesExportacao,
    ),
  { ssr: false },
);
const RelatorioView = dynamic(
  () =>
    import("@/components/relatorio/RelatorioView").then(
      (mod) => mod.RelatorioView,
    ),
  {
    ssr: false,
    loading: () => <RelatorioSkeleton />,
  },
);
import type { Aba } from "@/components/Tabs";
import type {
  AchadoEntrada,
  Confianca,
  Relatorio,
  RelatorioEntrada,
  ResumoRelatorio,
  Severidade,
} from "@/lib/tipos";

const SEVERIDADES: Severidade[] = ["Critica", "Alta", "Media", "Baixa"];
const CONFIANCAS: Confianca[] = ["Alta", "Media", "Baixa"];

const ACHADO_VAZIO: AchadoEntrada = {
  titulo: "",
  severidade: "Media",
  cwe: "",
  descricao: "",
  evidencia: "",
  confianca: "Media",
  dataRetesteSugerida: "",
};

/**
 * Linha do formulário com chave estável para o React. Sem ela, `key={i}`
 * reutilizava o DOM errado ao remover/duplicar do meio (foco e valores
 * trocavam de achado). A chave nunca viaja para a API (montarEntrada tira).
 */
type AchadoForm = AchadoEntrada & { chave: string };

let seqAchado = 0;
function novaChaveAchado(): string {
  seqAchado += 1;
  return `achado-${Date.now()}-${seqAchado}`;
}
function novoAchado(): AchadoForm {
  return { ...ACHADO_VAZIO, chave: novaChaveAchado() };
}

export default function Home() {
  const [eng, setEng] = useState({
    cliente: "",
    titulo: "Relatório de Teste de Intrusão",
    escopo: "",
    periodo: "",
    limitacoes: "",
    ferramentas: "",
  });
  const [achados, setAchados] = useState<AchadoForm[]>([novoAchado()]);

  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [aba, setAba] = useState<Aba>("verificacao");
  const [loading, setLoading] = useState(false);
  const [importando, setImportando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [resumo, setResumo] = useState<ResumoGeral | null>(null);

  const toast = useToast();
  const { sucesso, erro: toastErro, aviso: toastAviso } = toast;
  const { data: sessao } = useSession();
  const plano = sessao?.user?.plano ?? "free";
  const paywall = usePaywall();
  const [avisoUso, setAvisoUso] = useState<string | null>(null);
  const [avisoFechado, setAvisoFechado] = useState(false);
  const [uso, setUso] = useState<{
    relatorios: { usados: number; limite: number | null };
    retestes: { usados: number; limite: number | null };
  } | null>(null);

  /** Copia texto e avisa — funciona em contexto http e https. */
  const copiar = useCallback(
    async (texto: string, rotulo: string) => {
      try {
        await navigator.clipboard.writeText(texto);
        sucesso(rotulo);
      } catch {
        // clipboard API exige contexto seguro; cai para a seleção manual.
        toastAviso("Não foi possível copiar automaticamente. Selecione o texto.");
      }
    },
    [sucesso, toastAviso],
  );

  // A sidebar precisa da contagem de relatórios em qualquer aba, e o painel
  // Histórico só monta quando está visível. Busca uma vez no mount.
  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const res = await fetch("/api/v1/relatorios");
        if (!res.ok || !ativo) return;
        const dados = (await res.json()) as ResumoRelatorio[];
        setResumo((atual) => ({
          relatorios: atual?.relatorios ?? dados.length,
          pendentes: atual?.pendentes ?? 0,
          verificados: atual?.verificados ?? 0,
          naoCorrigidos: atual?.naoCorrigidos ?? 0,
        }));
      } catch {
        // silencioso: a sidebar mostra "—" e o painel da aba avisa
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  // Uso do mês (sidebar) + soft warning a 80% (só no free).
  useEffect(() => {
    const controlador = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/v1/uso", { signal: controlador.signal });
        if (!res.ok) return;
        const u = (await res.json()) as {
          relatorios: { usados: number; limite: number | null };
          retestes: { usados: number; limite: number | null };
        };
        if (controlador.signal.aborted) return;
        setUso({ relatorios: u.relatorios, retestes: u.retestes });
        if (plano !== "free") return;
        const cheios = [
          { rotulo: "relatórios", ...u.relatorios },
          { rotulo: "retestes", ...u.retestes },
        ].filter(
          (r) =>
            typeof r.limite === "number" &&
            r.limite > 0 &&
            r.usados / r.limite >= 0.8,
        );
        if (cheios.length > 0 && !controlador.signal.aborted) {
          const partes = cheios.map((r) => `${r.usados}/${r.limite} ${r.rotulo}`);
          setAvisoUso(`Você usou ${partes.join(" e ")} este mês.`);
        }
      } catch {
        // silencioso: sem banner, sem problema
      }
    })();
    return () => controlador.abort();
  }, [plano]);

  /** O painel manda a contagem completa — nada é derivado aqui. */
  const atualizarResumo = useCallback((parcial: Partial<ResumoGeral>) => {
    setResumo((atual) => ({
      relatorios: atual?.relatorios ?? 0,
      pendentes: atual?.pendentes ?? 0,
      verificados: atual?.verificados ?? 0,
      naoCorrigidos: atual?.naoCorrigidos ?? 0,
      ...parcial,
    }));
  }, []);

  const atualizarResumoDeRelatorios = useCallback(
    (lista: ResumoRelatorio[]) => {
      atualizarResumo({ relatorios: lista.length });
    },
    [atualizarResumo],
  );

  /** Abre um relatório do histórico na aba "novo". */
  const abrirRelatorio = useCallback((r: Relatorio) => {
    setRelatorio(r);
    setAba("novo");
  }, []);

  function adicionarAchado() {
    setAchados((atuais) => [...atuais, novoAchado()]);
  }

  function duplicarAchado(indice: number) {
    setAchados((atuais) => {
      const copia = [...atuais];
      copia.splice(indice + 1, 0, {
        ...copia[indice],
        titulo: `${copia[indice].titulo} (cópia)`,
        chave: novaChaveAchado(),
      });
      return copia;
    });
  }

  function confirmarRemoverAchado(indice: number) {
    const achado = achados[indice];
    const rotulo = achado.titulo.trim()
      ? `"${achado.titulo.trim()}"`
      : `o achado ${indice + 1}`;

    if (window.confirm(`Remover ${rotulo}? Esta ação não pode ser desfeita.`)) {
      removerAchado(indice);
    }
  }

  function removerAchado(indice: number) {
    setAchados((atuais) => atuais.filter((_, i) => i !== indice));
  }

  /**
   * Junta achados prontos (scanner ou biblioteca) ao formulário. Linhas
   * vazias saem para dar lugar aos novos; o teto é o mesmo da geração.
   * Devolve quantos entraram.
   */
  function incluirAchados(novos: AchadoEntrada[]): number {
    const preenchidos = achados.filter(
      (a) => a.titulo.trim() || a.descricao.trim() || a.evidencia.trim(),
    );
    const cabem = novos.slice(0, Math.max(0, LIMITE_ACHADOS_FORM - preenchidos.length));
    const proximos = [
      ...preenchidos,
      ...cabem.map((n) => ({ ...n, chave: novaChaveAchado() })),
    ];
    setAchados(proximos.length > 0 ? proximos : [novoAchado()]);
    return cabem.length;
  }

  function usarModelo(id: string) {
    const modelo = achadoDoModelo(id);
    if (!modelo) return;
    if (incluirAchados([modelo]) === 0) {
      toastErro(`O formulário já tem ${LIMITE_ACHADOS_FORM} achados, o máximo por relatório.`);
    }
  }

  async function importarArquivo(arquivo: File) {
    if (arquivo.size > LIMITE_IMPORTACAO_BYTES) {
      toastErro("Arquivo maior que 15 MB. Exporte só o escopo do engagement.");
      return;
    }
    setImportando(true);
    try {
      const res = await fetch("/api/v1/importar", {
        method: "POST",
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: await arquivo.text(),
      });
      const corpo = await res.json().catch(() => null);
      if (!res.ok) {
        toastErro(corpo?.error ?? "Não foi possível importar o arquivo.");
        return;
      }
      const r = corpo as ResultadoImportacao;
      const nome = NOME_SCANNER[r.formato];
      if (r.achados.length === 0) {
        toastAviso(`O arquivo do ${nome} não tem achados acima de informativo.`);
        return;
      }
      const entraram = incluirAchados(r.achados);
      setEng((atual) =>
        atual.ferramentas.toLowerCase().includes(nome.toLowerCase())
          ? atual
          : { ...atual, ferramentas: atual.ferramentas.trim() ? `${atual.ferramentas.trim()}, ${nome}` : nome },
      );
      const detalhes = [
        `${r.ocorrencias} ocorrência${r.ocorrencias === 1 ? "" : "s"} agrupada${r.ocorrencias === 1 ? "" : "s"}`,
        r.informativosIgnorados ? `${r.informativosIgnorados} informativo(s) ignorado(s)` : "",
        r.truncado || entraram < r.achados.length ? "só os mais graves couberam no limite de 50" : "",
      ].filter(Boolean);
      sucesso(
        `${entraram} achado${entraram === 1 ? "" : "s"} importado${entraram === 1 ? "" : "s"} do ${nome} (${detalhes.join("; ")}). Revise e valide antes de gerar.`,
      );
    } catch {
      toastErro("Não foi possível conectar ao servidor. Verifique sua conexão.");
    } finally {
      setImportando(false);
    }
  }

  function atualizarAchado(indice: number, mudanca: Partial<AchadoEntrada>) {
    setAchados((atuais) =>
      atuais.map((a, i) => (i === indice ? { ...a, ...mudanca } : a)),
    );
  }

  function montarEntrada(): RelatorioEntrada {
    return {
      ...eng,
      achados: achados
        .filter((a) => a.titulo.trim() || a.descricao.trim())
        .map(({ chave: _chave, ...resto }) => resto),
    };
  }

  async function gerar() {
    const entrada = montarEntrada();

    if (entrada.achados.length === 0) {
      toastErro(
        "Nenhum achado tem título. Preencha o título de pelo menos um achado antes de gerar o relatório.",
      );
      return;
    }

    const semTitulo = entrada.achados.filter((a) => !a.titulo.trim()).length;

    if (semTitulo > 0) {
      toastErro(
        semTitulo === 1
          ? "1 achado está sem título. O relatório usa o título como identificação (FINDING-001). Preencha-o ou remova o achado."
          : `${semTitulo} achados estão sem título. Preencha o título de cada um ou remova os que estão vazios.`,
      );
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/v1/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entrada),
      });
      const corpo = await res.json().catch(() => null);

      if (!res.ok) {
        toastErro(corpo?.error ?? "A geração falhou. Tente novamente.");
        return;
      }

      if (!corpo?.achados?.length) {
        toastErro("A geração voltou sem achados. Revise os dados e tente de novo.");
        return;
      }

      setRelatorio(corpo as Relatorio);

      const protegidos = lerResumoProtecao(res.headers.get("X-Laudo-Protegidos"));
      if (protegidos.length > 0) {
        const total = protegidos.reduce((soma, p) => soma + p.quantidade, 0);
        sucesso(
          `Escudo de privacidade: ${total} dado${total === 1 ? "" : "s"} do cliente protegido${total === 1 ? "" : "s"} antes da IA (${protegidos
            .map((p) => `${ROTULO_TIPO[p.tipo]}: ${p.quantidade}`)
            .join(", ")}). A IA não viu nenhum deles.`,
        );
      }
    } catch {
      toastErro("Não foi possível conectar ao servidor. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  }

  async function salvar() {
    if (!relatorio) return;

    setSalvando(true);

    try {
      const res = await fetch("/api/v1/relatorios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(relatorio),
      });
      const corpo = await res.json().catch(() => null);

      if (!res.ok) {
        // 402 = limite do plano: abre o paywall em vez do toast.
        if (
          res.status === 402 &&
          corpo &&
          typeof corpo.recurso === "string" &&
          typeof corpo.usados === "number" &&
          typeof corpo.limite === "number"
        ) {
          dispararPaywall({
            recurso: corpo.recurso,
            usados: corpo.usados,
            limite: corpo.limite,
          });
          return;
        }
        toastErro(corpo?.error ?? "Não foi possível salvar o relatório.");
        return;
      }

      sucesso(
        `Relatório salvo com ID #${corpo.id}. Os achados já estão na aba Verificação.`,
      );
    } catch {
      toastErro("Não foi possível conectar ao servidor. Verifique sua conexão.");
    } finally {
      setSalvando(false);
    }
  }

  const entrada = montarEntrada();
  const achadosSemTitulo = entrada.achados.filter((a) => !a.titulo.trim()).length;

  return (
    <ErrorBoundary>
      <Onboarding />
      {paywall.info && (
        <PaywallModal info={paywall.info} onFechar={paywall.fechar} />
      )}
      <>
        <Header
        aba={aba}
        onAba={setAba}
        contagem={relatorio ? { novo: relatorio.achados.length } : undefined}
        pendentes={resumo?.pendentes}
      />

      <ToastViewport toasts={toast.toasts} onDisparar={toast.remover} />

      {avisoUso && !avisoFechado && (
        <div className="no-print border-b border-media/30 bg-media/10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 sm:px-6">
            <span aria-hidden="true" className="font-mono text-xs text-media">
              !
            </span>
            <p className="flex-1 font-mono text-[11px] text-media">
              {avisoUso} Considere fazer upgrade.
            </p>
            <a
              href="/precos"
              className="font-mono text-[11px] uppercase tracking-wider text-media underline underline-offset-2 hover:text-texto"
            >
              ver planos
            </a>
            <button
              type="button"
              aria-label="Fechar aviso"
              onClick={() => setAvisoFechado(true)}
              className="cursor-pointer font-mono text-xs text-media/70 hover:text-media"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <main className="flex-1">
        <LayoutComSidebar
          resumo={resumo}
          uso={
            uso
              ? {
                  plano,
                  relatoriosUsados: uso.relatorios.usados,
                  relatoriosLimite: uso.relatorios.limite,
                  retestesUsados: uso.retestes.usados,
                  retestesLimite: uso.retestes.limite,
                }
              : null
          }
        >
        {aba === "verificacao" && (
          <Suspense
            fallback={
              <p className="font-mono text-xs text-texto-2">
                carregando verificação…
              </p>
            }
          >
            <PainelVerificacao
              onCopiar={copiar}
              onAviso={toastErro}
              onResumo={atualizarResumo}
              plano={plano}
            />
          </Suspense>
        )}

        {aba === "historico" && (
          <Suspense
            fallback={
              <p className="font-mono text-xs text-texto-2">
                carregando histórico…
              </p>
            }
          >
            <PainelHistorico
              onAviso={toastErro}
              onResumo={atualizarResumoDeRelatorios}
              onAbrir={abrirRelatorio}
            />
          </Suspense>
        )}

        {aba === "novo" && (
          <>
        <div className="no-print flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Dados do engagement</CardTitle>
              <CardDescription>
                Preencha o que você sabe. O que ficar em branco aparece como “não
                informado” no relatório.
              </CardDescription>
            </CardHeader>

            <div className="flex flex-col gap-5 p-5 sm:p-6">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Cliente" htmlFor="cliente">
                  <Input
                    id="cliente"
                    placeholder="Acme Corp"
                    value={eng.cliente}
                    onChange={(e) => setEng({ ...eng, cliente: e.target.value })}
                  />
                </Field>

                <Field label="Título do relatório" htmlFor="titulo-relatorio">
                  <Input
                    id="titulo-relatorio"
                    placeholder="Relatório de Teste de Intrusão"
                    value={eng.titulo}
                    onChange={(e) => setEng({ ...eng, titulo: e.target.value })}
                  />
                </Field>
              </div>

              <Field
                label="Escopo"
                htmlFor="escopo"
                dica="o que foi testado — ex.: aplicação web, API REST, infraestrutura"
              >
                <Textarea
                  id="escopo"
                  rows={2}
                  placeholder="Aplicação web https://app.acme.com e API https://api.acme.com/v2"
                  value={eng.escopo}
                  onChange={(e) => setEng({ ...eng, escopo: e.target.value })}
                />
              </Field>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Período do teste" htmlFor="periodo">
                  <Input
                    id="periodo"
                    className="font-mono text-xs"
                    placeholder="01/10/2026 a 09/10/2026"
                    value={eng.periodo}
                    onChange={(e) => setEng({ ...eng, periodo: e.target.value })}
                  />
                </Field>

                <Field
                  label="Ferramentas"
                  htmlFor="ferramentas"
                  dica="separadas por vírgula"
                >
                  <Input
                    id="ferramentas"
                    className="font-mono text-xs"
                    placeholder="Burp Suite, Nmap, SQLmap"
                    value={eng.ferramentas}
                    onChange={(e) => setEng({ ...eng, ferramentas: e.target.value })}
                  />
                </Field>
              </div>

              <Field
                label="Limitações"
                htmlFor="limitacoes"
                dica="o que ficou fora do escopo ou não pôde ser testado"
              >
                <Textarea
                  id="limitacoes"
                  rows={2}
                  placeholder="Testes não autenticados; sem acesso ao ambiente de homologação."
                  value={eng.limitacoes}
                  onChange={(e) => setEng({ ...eng, limitacoes: e.target.value })}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Achados</CardTitle>
                <CardDescription>
                  A IA calcula CVSS, OWASP, impacto, passos de reprodução e
                  remediação a partir do que você escreve aqui.
                </CardDescription>
              </div>
              <span className="font-mono text-[11px] text-texto-2">
                {achados.length} achado{achados.length === 1 ? "" : "s"}
                {achadosSemTitulo > 0 && (
                  <span className="ml-2 text-media">
                    · {achadosSemTitulo} sem título
                  </span>
                )}
              </span>
            </CardHeader>

            {/* Atalhos de entrada: scanner e biblioteca. */}
            <div className="flex flex-col gap-3 border-b border-borda px-5 py-4 sm:flex-row sm:items-center sm:px-6">
              <label
                className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-accent/50 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-accent transition-colors duration-200 hover:bg-accent/10 ${
                  importando ? "pointer-events-none opacity-60" : ""
                }`}
              >
                {importando ? <Spinner /> : <span aria-hidden="true">↥</span>}
                {importando ? "importando…" : "importar de scanner"}
                <input
                  type="file"
                  accept=".nessus,.xml,.json,.sarif"
                  className="sr-only"
                  disabled={importando}
                  onChange={(e) => {
                    const arquivo = e.target.files?.[0];
                    e.target.value = "";
                    if (arquivo) void importarArquivo(arquivo);
                  }}
                />
              </label>
              <Select
                aria-label="Adicionar achado da biblioteca"
                className="min-w-0 font-mono text-xs sm:max-w-xs sm:flex-1"
                value=""
                onChange={(e) => usarModelo(e.target.value)}
              >
                <option value="" disabled>
                  + adicionar da biblioteca…
                </option>
                {CATEGORIAS.map((cat) => (
                  <optgroup key={cat} label={cat}>
                    {BIBLIOTECA.filter((m) => m.categoria === cat).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.titulo}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
              <p className="text-xs leading-relaxed text-texto-2 sm:ml-auto sm:max-w-[16rem] sm:text-right">
                Nessus, Burp, ZAP e SARIF (Semgrep, CodeQL, Trivy…). Achados iguais viram um só.
              </p>
            </div>

            <div className="flex flex-col gap-5 p-5 sm:p-6">
              {achados.map((achado, i) => (
                <div
                  key={achado.chave}
                  className="rounded-md border border-borda bg-superficie-2 p-4 sm:p-5"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span className="font-mono text-[10px] font-medium tracking-widest text-accent">
                      ACHADO {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="flex items-center gap-2">
                      <SeverityBadge severidade={achado.severidade} />
                      <button
                        type="button"
                        onClick={() => duplicarAchado(i)}
                        aria-label="Duplicar achado"
                        title="Duplicar este achado"
                        className="cursor-pointer rounded-sm border border-borda px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-texto-2 transition-colors duration-200 hover:border-accent hover:text-accent"
                      >
                        duplicar
                      </button>
                      {achados.length > 1 && (
                        <button
                          type="button"
                          onClick={() => confirmarRemoverAchado(i)}
                          aria-label="Remover achado"
                          title="Remover este achado"
                          className="cursor-pointer rounded-sm border border-borda px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-texto-2 transition-colors duration-200 hover:border-critica/50 hover:text-critica"
                        >
                          remover
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <Field label="Título" htmlFor={`achado-${i}-titulo`}>
                      <Input
                        id={`achado-${i}-titulo`}
                        placeholder="SQL Injection no formulário de login"
                        value={achado.titulo}
                        onChange={(e) =>
                          atualizarAchado(i, { titulo: e.target.value })
                        }
                      />
                    </Field>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_12rem]">
                      <Field label="Severidade" htmlFor={`achado-${i}-severidade`}>
                        <Select
                          id={`achado-${i}-severidade`}
                          className="font-mono text-xs"
                          value={achado.severidade}
                          onChange={(e) =>
                            atualizarAchado(i, {
                              severidade: e.target.value as Severidade,
                            })
                          }
                        >
                          {SEVERIDADES.map((s) => (
                            <option key={s} value={s}>
                              {s.toLowerCase()}
                            </option>
                          ))}
                        </Select>
                      </Field>

                      <Field label="CWE" htmlFor={`achado-${i}-cwe`}>
                        <Input
                          id={`achado-${i}-cwe`}
                          className="font-mono text-xs"
                          placeholder="CWE-89"
                          value={achado.cwe}
                          onChange={(e) =>
                            atualizarAchado(i, { cwe: e.target.value })
                          }
                        />
                      </Field>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_12rem]">
                      <Field
                        label="Confiança"
                        htmlFor={`achado-${i}-confianca`}
                        dica="quão certo você está deste achado — usada no ciclo de verificação"
                      >
                        <Select
                          id={`achado-${i}-confianca`}
                          className="font-mono text-xs"
                          value={achado.confianca}
                          onChange={(e) =>
                            atualizarAchado(i, {
                              confianca: e.target.value as Confianca,
                            })
                          }
                        >
                          {CONFIANCAS.map((c) => (
                            <option key={c} value={c}>
                              {c.toLowerCase()}
                            </option>
                          ))}
                        </Select>
                      </Field>

                      <Field
                        label="Reteste sugerido"
                        htmlFor={`achado-${i}-reteste`}
                        dica="opcional"
                      >
                        <Input
                          id={`achado-${i}-reteste`}
                          type="date"
                          className="font-mono text-xs"
                          value={achado.dataRetesteSugerida}
                          onChange={(e) =>
                            atualizarAchado(i, {
                              dataRetesteSugerida: e.target.value,
                            })
                          }
                        />
                      </Field>
                    </div>

                    <Field
                      label="Descrição"
                      htmlFor={`achado-${i}-descricao`}
                      dica="contexto, causa raiz observada e o que o atacante consegue fazer"
                    >
                      <Textarea
                        id={`achado-${i}-descricao`}
                        rows={3}
                        placeholder="O campo de usuário concatena o input diretamente na query SQL..."
                        value={achado.descricao}
                        onChange={(e) =>
                          atualizarAchado(i, { descricao: e.target.value })
                        }
                      />
                    </Field>

                    <Field
                      label="Evidência"
                      htmlFor={`achado-${i}-evidencia`}
                      dica="requisição, resposta, payload — entra no relatório como está"
                    >
                      <Textarea
                        id={`achado-${i}-evidencia`}
                        rows={3}
                        className="font-mono text-xs leading-relaxed"
                        placeholder="GET /login?user=admin' OR '1'='1  →  HTTP/1.1 200 OK"
                        value={achado.evidencia}
                        onChange={(e) =>
                          atualizarAchado(i, { evidencia: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                </div>
              ))}

              <Button variante="secundaria" onClick={adicionarAchado} className="self-start">
                + adicionar achado
              </Button>

              <p className="flex items-start gap-2 rounded-md border border-accent/25 bg-accent/[0.05] px-3 py-2.5 text-xs leading-relaxed text-texto-2">
                <span aria-hidden="true" className="font-mono text-accent">
                  ◈
                </span>
                <span>
                  <span className="font-medium text-texto">Escudo de privacidade ativo.</span>{" "}
                  Antes de enviar à IA, o Provafix troca IPs, domínios, e-mails, CPF/CNPJ,
                  senhas, tokens e o nome do cliente por marcadores — e devolve os dados
                  reais só no seu relatório.
                </span>
              </p>

              <div className="flex flex-col gap-3 border-t border-borda pt-5 sm:flex-row">
                <Button
                  variante="primaria"
                  tamanho="lg"
                  onClick={gerar}
                  disabled={loading}
                  className="sm:flex-1"
                >
                  {loading ? (
                    <>
                      <Spinner />
                      gerando relatório...
                    </>
                  ) : (
                    "gerar relatório"
                  )}
                </Button>
                <Button
                  variante="secundaria"
                  tamanho="lg"
                  onClick={salvar}
                  disabled={!relatorio || salvando}
                >
                  {salvando ? (
                    <>
                      <Spinner />
                      salvando...
                    </>
                  ) : (
                    "salvar relatório"
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {loading && <RelatorioSkeleton />}

        {!loading && !relatorio && (
          <div className="mt-8 rounded-md border border-dashed border-borda px-6 py-12 text-center">
            <p className="font-mono text-xs text-texto-2">
              nenhum relatório gerado
              <span className="animate-blink text-accent"> ▋</span>
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-texto-2/70">
              Preencha os achados acima e execute “gerar relatório” para produzir
              o documento completo.
            </p>
          </div>
        )}

{!loading && relatorio && (
          <>
            <div className="no-print mt-8 flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-[11px] uppercase tracking-widest text-texto-2">
                pré-visualização · o PDF oculta esta barra
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Suspense fallback={null}>
                  <AcoesExportacao
                    relatorio={relatorio}
                    jiraBaseUrl={process.env.NEXT_PUBLIC_JIRA_URL}
                    githubRepoUrl={process.env.NEXT_PUBLIC_GITHUB_REPO_URL}
                    plano={plano}
                  />
                </Suspense>
                <Button variante="secundaria" onClick={salvar} disabled={salvando}>
                  {salvando ? "salvando..." : "salvar"}
                </Button>
                <Button variante="sucesso" onClick={() => window.print()}>
                  exportar pdf
                </Button>
              </div>
            </div>

            <div className="mt-4">
              <Suspense fallback={<RelatorioSkeleton />}>
                <RelatorioView relatorio={relatorio} marcaDagua={plano === "free"} />
              </Suspense>
            </div>
          </>
        )}
          </>
        )}
        </LayoutComSidebar>
      </main>

      <footer className="no-print border-t border-borda">
        <div className="mx-auto max-w-4xl px-4 py-6 text-center font-mono text-[11px] text-texto-2/60 sm:px-6">
          laudo v0.2 · conteúdo gerado por ia — revise antes de entregar ao cliente
        </div>
      </footer>
      </>
    </ErrorBoundary>
  );
}

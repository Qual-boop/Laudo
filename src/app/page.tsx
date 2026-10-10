"use client";

import { useState } from "react";
import { Alert } from "@/components/Alert";
import { Button } from "@/components/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/Card";
import { Field, Input, Select, Textarea } from "@/components/Field";
import { Logo } from "@/components/Logo";
import { SeverityBadge } from "@/components/SeverityBadge";
import { Spinner } from "@/components/Spinner";
import { RelatorioSkeleton } from "@/components/relatorio/RelatorioSkeleton";
import { RelatorioView } from "@/components/relatorio/RelatorioView";
import { PainelHistorico } from "@/components/historico/PainelHistorico";
import { PainelVerificacao } from "@/components/verificacao/PainelVerificacao";
import { Tabs, type Aba } from "@/components/Tabs";
import type {
  AchadoEntrada,
  Confianca,
  Relatorio,
  RelatorioEntrada,
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

export default function Home() {
  const [eng, setEng] = useState({
    cliente: "",
    titulo: "Relatório de Teste de Intrusão",
    escopo: "",
    periodo: "",
    limitacoes: "",
    ferramentas: "",
  });
  const [achados, setAchados] = useState<AchadoEntrada[]>([{ ...ACHADO_VAZIO }]);

  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [aba, setAba] = useState<Aba>("novo");
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function adicionarAchado() {
    setAchados((atuais) => [...atuais, { ...ACHADO_VAZIO }]);
  }

  function duplicarAchado(indice: number) {
    setAchados((atuais) => {
      const copia = [...atuais];
      copia.splice(indice + 1, 0, { ...copia[indice], titulo: `${copia[indice].titulo} (cópia)` });
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

  function atualizarAchado(indice: number, mudanca: Partial<AchadoEntrada>) {
    setAchados((atuais) =>
      atuais.map((a, i) => (i === indice ? { ...a, ...mudanca } : a)),
    );
  }

  function montarEntrada(): RelatorioEntrada {
    return {
      ...eng,
      achados: achados.filter((a) => a.titulo.trim() || a.descricao.trim()),
    };
  }

  async function gerar() {
    const entrada = montarEntrada();

    if (entrada.achados.length === 0) {
      setErro(
        "Nenhum achado tem título. Preencha o título de pelo menos um achado antes de gerar o relatório.",
      );
      return;
    }

    const semTitulo = entrada.achados.filter((a) => !a.titulo.trim()).length;

    if (semTitulo > 0) {
      setErro(
        semTitulo === 1
          ? "1 achado está sem título. O relatório usa o título como identificação (FINDING-001). Preencha-o ou remova o achado."
          : `${semTitulo} achados estão sem título. Preencha o título de cada um ou remova os que estão vazios.`,
      );
      return;
    }

    setErro(null);
    setAviso(null);
    setLoading(true);

    try {
      const res = await fetch("/api/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entrada),
      });
      const corpo = await res.json().catch(() => null);

      if (!res.ok) {
        setErro(corpo?.error ?? "A geração falhou. Tente novamente.");
        return;
      }

      if (!corpo?.achados?.length) {
        setErro("A geração voltou sem achados. Revise os dados e tente de novo.");
        return;
      }

      setRelatorio(corpo as Relatorio);
    } catch {
      setErro("Não foi possível conectar ao servidor. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  }

  async function salvar() {
    if (!relatorio) return;

    setErro(null);
    setAviso(null);
    setSalvando(true);

    try {
      const res = await fetch("/api/relatorios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(relatorio),
      });
      const corpo = await res.json().catch(() => null);

      if (!res.ok) {
        setErro(corpo?.error ?? "Não foi possível salvar o relatório.");
        return;
      }

      setAviso(
        `Relatório salvo com ID #${corpo.id}. Os achados já estão na aba Verificação.`,
      );
    } catch {
      setErro("Não foi possível conectar ao servidor. Verifique sua conexão.");
    } finally {
      setSalvando(false);
    }
  }

  const entrada = montarEntrada();
  const achadosSemTitulo = entrada.achados.filter((a) => !a.titulo.trim()).length;

  return (
    <>
      <header className="no-print sticky top-0 z-10 border-b border-borda bg-fundo/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-6 sm:px-6">
          <Logo className="h-10 w-10 shrink-0 text-accent" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-texto">Laudo</h1>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-texto-2">
              gerador de relatório de pentest
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Tabs
          ativa={aba}
          onChange={setAba}
          contagem={relatorio ? { novo: relatorio.achados.length } : undefined}
        />

        {aba === "verificacao" && (
          <div className="mt-6">
            <PainelVerificacao />
          </div>
        )}

        {aba === "historico" && (
          <div className="mt-6">
            <PainelHistorico
              onAbrir={(r) => {
                setRelatorio(r);
                setAba("novo");
              }}
            />
          </div>
        )}

        {aba === "novo" && (
          <>
        <div className="no-print mt-6 flex flex-col gap-5">
          {erro && <Alert tom="erro">{erro}</Alert>}
          {aviso && <Alert tom="sucesso">{aviso}</Alert>}

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

            <div className="flex flex-col gap-5 p-5 sm:p-6">
              {achados.map((achado, i) => (
                <div
                  key={i}
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
                        title="Duplicar este achado"
                        className="cursor-pointer rounded-sm border border-borda px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-texto-2 transition-colors duration-200 hover:border-accent hover:text-accent"
                      >
                        duplicar
                      </button>
                      {achados.length > 1 && (
                        <button
                          type="button"
                          onClick={() => confirmarRemoverAchado(i)}
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
              <div className="flex gap-2">
                <Button variante="secundaria" onClick={salvar} disabled={salvando}>
                  {salvando ? "salvando..." : "salvar"}
                </Button>
                <Button variante="sucesso" onClick={() => window.print()}>
                  exportar pdf
                </Button>
              </div>
            </div>

            <div className="mt-4">
              <RelatorioView relatorio={relatorio} />
            </div>
          </>
        )}
          </>
        )}
      </main>

      <footer className="no-print border-t border-borda">
        <div className="mx-auto max-w-4xl px-4 py-6 text-center font-mono text-[11px] text-texto-2/60 sm:px-6">
          laudo v0.2 · conteúdo gerado por ia — revise antes de entregar ao cliente
        </div>
      </footer>
    </>
  );
}

import "./documento.css";
import { Logo } from "@/components/Logo";
import { ORDEM_SEVERIDADE, ROTULO_SEVERIDADE, type AchadoDocumento, type Documento } from "@/lib/documento";
import {
  COR_SEVERIDADE,
  ROTULO_RESULTADO,
  ROTULO_STATUS,
  cvssTexto,
  dataBr,
  estiloPagina,
  faixaCvss,
} from "@/lib/documento-formato";
import { COR_PADRAO, corLegivel } from "@/lib/marca";
import { PRAZO_DIAS, rotuloPrazo } from "@/lib/prazos";

/**
 * Relatório final para o cliente — o PDF "de verdade": capa, controle do
 * documento, sumário com links, sumário executivo com gráfico, tabela de
 * achados, um achado por página com reteste e prazo, recomendações,
 * conclusão, apêndices (escala CVSS e prazos) e bloco de assinatura.
 * Cabeçalho, rodapé e "Página X de Y" vêm do @page (documento-formato.ts).
 */

const ROTULO_RISCO: Record<string, string> = {
  Critico: "Crítico",
  Alto: "Alto",
  Medio: "Médio",
  Baixo: "Baixo",
};

function Sev({ s }: { s: AchadoDocumento["severidade"] }) {
  return <span className={`doc-sev doc-sev-${s}`}>{ROTULO_SEVERIDADE[s]}</span>;
}

function ancora(id: string): string {
  return `achado-${id.replace(/[^A-Za-z0-9_-]/g, "-")}`;
}

function Paragrafos({ texto, vazio = "Não informado." }: { texto: string; vazio?: string }) {
  const partes = texto.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (partes.length === 0) return <p className="doc-suave">{vazio}</p>;
  return (
    <>
      {partes.map((p, i) => (
        <p key={i} style={{ whiteSpace: "pre-line" }}>
          {p}
        </p>
      ))}
    </>
  );
}

export function DocumentoRelatorio({ doc }: { doc: Documento }) {
  const { relatorio, achados, marca, resumo } = doc;
  const { capa, sumarioExecutivo: sum, escopoMetodologia: esc } = relatorio;
  const cor = corLegivel(marca?.cor ?? COR_PADRAO);
  const autor = marca?.nome?.trim() || "Provafix";
  const maxSev = Math.max(1, ...ORDEM_SEVERIDADE.map((s) => resumo.porSeveridade[s]));
  const comReteste = achados.some((a) => a.verificacao && a.verificacao.totalRetestes > 0);

  const secoes = [
    { id: "sec-sumario", titulo: "Sumário executivo" },
    { id: "sec-escopo", titulo: "Escopo e metodologia" },
    { id: "sec-visao", titulo: "Visão geral dos achados" },
    { id: "sec-achados", titulo: "Achados detalhados" },
    { id: "sec-recomendacoes", titulo: "Recomendações gerais" },
    { id: "sec-conclusao", titulo: "Conclusão" },
    { id: "sec-apendices", titulo: "Apêndices" },
  ];

  return (
    <div className="doc" style={{ ["--doc-cor" as string]: cor }}>
      <style>
        {estiloPagina({
          topoEsquerda: `${capa.cliente} — ${capa.titulo}`,
          topoDireita: capa.classificacao.toUpperCase(),
          rodapeEsquerda: marca?.nome
            ? `${marca.nome} · v${capa.versao} · gerado com Provafix`
            : `Provafix · v${capa.versao}`,
        })}
      </style>

      {doc.marcaDagua && (
        <div className="doc-marca-dagua" aria-hidden="true">
          Provafix Free
        </div>
      )}

      {/* ------------------------------ CAPA ------------------------------ */}
      <section className="doc-folha doc-capa">
        <div className="doc-capa-faixa" />
        <div className="doc-capa-corpo">
          {marca?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL do logo da consultoria
            <img className="doc-capa-logo" src={marca.logo} alt={autor} />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: cor }}>
              <Logo className="h-12 w-12" />
              <strong style={{ fontSize: "16pt", color: "var(--doc-texto)" }}>{autor}</strong>
            </div>
          )}

          <p className="doc-rotulo" style={{ marginTop: "46mm" }}>
            Relatório de teste de intrusão
          </p>
          <h1 className="doc-capa-titulo" style={{ marginTop: "4mm" }}>
            {capa.titulo}
          </h1>
          <p className="doc-capa-cliente">{capa.cliente}</p>
          <span className="doc-capa-classificacao">{capa.classificacao}</span>

          <div className="doc-capa-meta">
            <div>
              <p className="doc-rotulo">Data</p>
              <p>{dataBr(capa.data) || "—"}</p>
            </div>
            <div>
              <p className="doc-rotulo">Versão</p>
              <p>{capa.versao}</p>
            </div>
            <div>
              <p className="doc-rotulo">Elaborado por</p>
              <p>{autor}</p>
            </div>
            <div>
              <p className="doc-rotulo">Responsável técnico</p>
              <p>{marca?.responsavel || "—"}</p>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------- CONTROLE + SUMÁRIO ------------------------ */}
      <section className="doc-folha">
        <h2>Controle do documento</h2>
        <table>
          <tbody>
            <tr><th scope="row">Cliente</th><td>{capa.cliente}</td></tr>
            <tr><th scope="row">Título</th><td>{capa.titulo}</td></tr>
            <tr><th scope="row">Versão</th><td>{capa.versao}</td></tr>
            <tr><th scope="row">Data do relatório</th><td>{dataBr(capa.data) || "—"}</td></tr>
            <tr><th scope="row">Período dos testes</th><td>{esc.periodo || "—"}</td></tr>
            <tr><th scope="row">Classificação</th><td>{capa.classificacao}</td></tr>
            <tr><th scope="row">Elaborado por</th><td>{autor}{marca?.contato ? ` · ${marca.contato}` : ""}</td></tr>
            {marca?.responsavel && (
              <tr><th scope="row">Responsável técnico</th><td>{marca.responsavel}</td></tr>
            )}
          </tbody>
        </table>
        <p className="doc-suave" style={{ fontSize: "9pt" }}>
          Este documento contém informações confidenciais sobre a segurança de {capa.cliente}. A
          distribuição deve se limitar às pessoas autorizadas pelo cliente.
        </p>

        <h2 style={{ marginTop: 22 }}>Sumário</h2>
        <nav className="doc-indice" aria-label="Sumário">
          <ul>
            {secoes.map((s, i) => (
              <li key={s.id}>
                <span className="doc-num">{i + 1}.</span>
                <a href={`#${s.id}`}>{s.titulo}</a>
              </li>
            ))}
          </ul>
          {achados.length > 0 && (
            <ul style={{ marginLeft: 22, marginTop: 4 }}>
              {achados.map((a) => (
                <li key={a.id} style={{ fontSize: "9pt" }}>
                  <span className="doc-mono doc-suave" style={{ width: 92, flexShrink: 0 }}>{a.id}</span>
                  <a href={`#${ancora(a.id)}`} style={{ flex: 1 }}>{a.titulo}</a>
                  <Sev s={a.severidade} />
                </li>
              ))}
            </ul>
          )}
        </nav>
      </section>

      {/* ------------------------ 1. SUMÁRIO EXECUTIVO ------------------- */}
      <section className="doc-folha doc-quebra" id="sec-sumario">
        <h2><span className="doc-num">1</span>Sumário executivo</h2>
        <div className="doc-kpis">
          <div className="doc-kpi">
            <span className="doc-rotulo">Risco geral</span>
            <strong>{ROTULO_RISCO[sum.riscoGeral] ?? sum.riscoGeral}</strong>
          </div>
          <div className="doc-kpi">
            <span className="doc-rotulo">Achados</span>
            <strong>{resumo.total}</strong>
          </div>
          <div className="doc-kpi">
            <span className="doc-rotulo">Críticos + altos</span>
            <strong>{resumo.porSeveridade.Critica + resumo.porSeveridade.Alta}</strong>
          </div>
          <div className="doc-kpi">
            <span className="doc-rotulo">{comReteste ? "Corrigidos" : "Retestes"}</span>
            <strong>{comReteste ? `${resumo.verificados}/${resumo.total}` : "—"}</strong>
          </div>
        </div>

        <Paragrafos texto={sum.visaoGeral} />

        <h3>Distribuição por severidade</h3>
        {ORDEM_SEVERIDADE.map((s) => (
          <div className="doc-barra" key={s}>
            <span className="doc-barra-rotulo">{ROTULO_SEVERIDADE[s]}</span>
            <span className="doc-barra-trilho">
              <span
                className="doc-barra-cheio"
                style={{
                  display: "block",
                  width: `${(resumo.porSeveridade[s] / maxSev) * 100}%`,
                  background: COR_SEVERIDADE[s],
                }}
              />
            </span>
            <span className="doc-barra-valor">{resumo.porSeveridade[s]}</span>
          </div>
        ))}

        {sum.principaisRiscos.length > 0 && (
          <>
            <h3>Principais riscos para o negócio</h3>
            <ol>
              {sum.principaisRiscos.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ol>
          </>
        )}

        {comReteste && (
          <div className="doc-caixa">
            <strong>Situação da correção:</strong> {resumo.verificados} corrigido(s) e verificado(s),{" "}
            {resumo.naoCorrigidos} não corrigido(s) no reteste e {resumo.pendentes} aguardando reteste
            {resumo.atrasados > 0 ? `; ${resumo.atrasados} fora do prazo recomendado` : ""}.
          </div>
        )}
      </section>

      {/* ------------------------ 2. ESCOPO ------------------------------ */}
      <section className="doc-folha doc-quebra" id="sec-escopo">
        <h2><span className="doc-num">2</span>Escopo e metodologia</h2>
        <table>
          <tbody>
            <tr><th scope="row">Escopo</th><td style={{ whiteSpace: "pre-line" }}>{esc.escopo || "Não informado."}</td></tr>
            <tr><th scope="row">Metodologia</th><td style={{ whiteSpace: "pre-line" }}>{esc.metodologia || "Não informada."}</td></tr>
            <tr><th scope="row">Ferramentas</th><td>{esc.ferramentas.join(", ") || "Não informadas."}</td></tr>
            <tr><th scope="row">Período</th><td>{esc.periodo || "Não informado."}</td></tr>
            <tr><th scope="row">Limitações</th><td style={{ whiteSpace: "pre-line" }}>{esc.limitacoes || "Nenhuma informada."}</td></tr>
          </tbody>
        </table>

        {/* ---------------------- 3. VISÃO GERAL ------------------------- */}
        <h2 id="sec-visao" style={{ marginTop: 24 }}>
          <span className="doc-num">3</span>Visão geral dos achados
        </h2>
        {achados.length === 0 ? (
          <p className="doc-suave">Nenhum achado registrado.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Achado</th>
                <th scope="col">Severidade</th>
                <th scope="col">CVSS</th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {achados.map((a) => (
                <tr key={a.id}>
                  <td className="doc-mono" style={{ whiteSpace: "nowrap", width: "auto", background: "none", fontWeight: 400 }}>{a.id}</td>
                  <td><a href={`#${ancora(a.id)}`} style={{ color: "inherit" }}>{a.titulo}</a></td>
                  <td><Sev s={a.severidade} /></td>
                  <td className="doc-mono">{cvssTexto(a.cvss.score)}</td>
                  <td style={{ fontSize: "8.5pt" }}>
                    {ROTULO_STATUS[a.verificacao?.status ?? "pendente"]}
                    {a.prazo && a.prazo.estado !== "no-prazo" && (
                      <span style={{ display: "block", color: "var(--sev-critica)" }}>{rotuloPrazo(a.prazo)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ------------------------ 4. ACHADOS ----------------------------- */}
      <section className="doc-folha doc-quebra" id="sec-achados">
        <h2><span className="doc-num">4</span>Achados detalhados</h2>
        <p className="doc-suave">
          Cada achado traz a evidência coletada, o impacto para o negócio, como reproduzir e como corrigir.
          A nota CVSS v3.1 é calculada pela fórmula oficial a partir do vetor.
        </p>
      </section>

      {achados.map((a, i) => (
        <section key={a.id} className="doc-folha doc-achado" id={ancora(a.id)}>
          <div className="doc-achado-cabeca">
            <div>
              <span className="doc-rotulo">4.{i + 1} · {a.id}</span>
              <h3>{a.titulo}</h3>
            </div>
            <Sev s={a.severidade} />
          </div>

          <div className="doc-meta">
            <div>
              <span className="doc-rotulo">CVSS v3.1</span>
              <br />
              <strong>{cvssTexto(a.cvss.score)}</strong> ({faixaCvss(a.cvss.score)})
            </div>
            <div>
              <span className="doc-rotulo">CWE</span>
              <br />
              {a.cwe || "—"}
            </div>
            <div>
              <span className="doc-rotulo">OWASP</span>
              <br />
              {a.owasp || "—"}
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <span className="doc-rotulo">Vetor</span>
              <br />
              <span className="doc-mono" style={{ fontSize: "8pt" }}>{a.cvss.vetor || "—"}</span>
            </div>
            <div>
              <span className="doc-rotulo">Confiança</span>
              <br />
              {a.confianca === "Media" ? "Média" : a.confianca}
            </div>
          </div>

          <h3>Descrição técnica</h3>
          <Paragrafos texto={a.descricaoTecnica} />

          <h3>Impacto no negócio</h3>
          <Paragrafos texto={a.impactoNegocio} />

          <h3>Evidência</h3>
          <pre>{a.evidencias || "Sem evidências informadas."}</pre>

          {a.passosReproducao.length > 0 && (
            <>
              <h3>Passos para reproduzir</h3>
              <ol>
                {a.passosReproducao.map((p, k) => (
                  <li key={k}>{p.replace(/^\s*\d+[.)]\s*/, "")}</li>
                ))}
              </ol>
            </>
          )}

          <h3>Remediação</h3>
          <table>
            <tbody>
              <tr><th scope="row">Curto prazo (contenção)</th><td style={{ whiteSpace: "pre-line" }}>{a.remediacao.curtoPrazo || "Não informado."}</td></tr>
              <tr><th scope="row">Longo prazo (correção definitiva)</th><td style={{ whiteSpace: "pre-line" }}>{a.remediacao.longoPrazo || "Não informado."}</td></tr>
              <tr><th scope="row">Prazo recomendado</th><td>{PRAZO_DIAS[a.severidade]} dias a partir da entrega{a.prazo ? ` (até ${dataBr(a.prazo.venceEm)})` : ""}</td></tr>
            </tbody>
          </table>

          {a.remediacao.referencias.length > 0 && (
            <>
              <h3>Referências</h3>
              <ul>
                {a.remediacao.referencias.map((r, k) => (
                  <li key={k} style={{ overflowWrap: "anywhere" }}>{r}</li>
                ))}
              </ul>
            </>
          )}

          <div className="doc-caixa">
            <strong>Reteste:</strong>{" "}
            {a.verificacao?.ultimoReteste ? (
              <>
                em {dataBr(a.verificacao.ultimoReteste.data)}, {ROTULO_RESULTADO[a.verificacao.ultimoReteste.resultado]}.{" "}
                {ROTULO_STATUS[a.verificacao.status]}.
                {a.verificacao.ultimoReteste.evidencia && (
                  <pre style={{ marginTop: 6 }}>{a.verificacao.ultimoReteste.evidencia}</pre>
                )}
              </>
            ) : (
              <>ainda não realizado{a.prazo ? ` — ${rotuloPrazo(a.prazo)}` : ""}.</>
            )}
          </div>
        </section>
      ))}

      {/* -------------------- 5. RECOMENDAÇÕES + 6. CONCLUSÃO ------------- */}
      <section className="doc-folha doc-quebra" id="sec-recomendacoes">
        <h2><span className="doc-num">5</span>Recomendações gerais</h2>
        {relatorio.recomendacoesGerais.length === 0 ? (
          <p className="doc-suave">Sem recomendações gerais além das de cada achado.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Prioridade</th>
                <th scope="col">Recomendação</th>
                <th scope="col">Por quê</th>
              </tr>
            </thead>
            <tbody>
              {relatorio.recomendacoesGerais.map((r, i) => (
                <tr key={i}>
                  <td style={{ width: "auto", background: "none" }}><Sev s={r.prioridade} /></td>
                  <td>{r.recomendacao}</td>
                  <td className="doc-suave">{r.justificativa}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h2 id="sec-conclusao" style={{ marginTop: 24 }}>
          <span className="doc-num">6</span>Conclusão
        </h2>
        <Paragrafos texto={relatorio.conclusao} />

        <div className="doc-assinatura">
          <strong>{marca?.responsavel || autor}</strong>
          <br />
          <span className="doc-suave">
            {marca?.responsavel ? `${autor} · ` : ""}
            {dataBr(capa.data)}
          </span>
        </div>
      </section>

      {/* ------------------------ 7. APÊNDICES --------------------------- */}
      <section className="doc-folha doc-quebra" id="sec-apendices">
        <h2><span className="doc-num">7</span>Apêndices</h2>
        <h3>A. Escala de severidade (CVSS v3.1)</h3>
        <table>
          <thead>
            <tr>
              <th scope="col">Severidade</th>
              <th scope="col">Nota CVSS</th>
              <th scope="col">Prazo de correção recomendado</th>
            </tr>
          </thead>
          <tbody>
            {([
              ["Critica", "9,0 – 10,0"],
              ["Alta", "7,0 – 8,9"],
              ["Media", "4,0 – 6,9"],
              ["Baixa", "0,1 – 3,9"],
            ] as const).map(([s, faixa]) => (
              <tr key={s}>
                <td style={{ width: "auto", background: "none" }}><Sev s={s} /></td>
                <td className="doc-mono">{faixa}</td>
                <td>{PRAZO_DIAS[s]} dias</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="doc-suave" style={{ fontSize: "9pt" }}>
          Prazos são referência de mercado para SLA de remediação; o prazo acordado com o cliente prevalece.
        </p>

        <h3>B. Aviso legal</h3>
        <Paragrafos
          texto={relatorio.disclaimer}
          vazio="Os testes refletem o estado dos sistemas no período avaliado e dentro do escopo acordado. A ausência de um achado não garante a ausência de vulnerabilidades."
        />
      </section>
    </div>
  );
}

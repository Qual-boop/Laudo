import "./documento.css";
import { Logo } from "@/components/Logo";
import { ORDEM_SEVERIDADE, ROTULO_SEVERIDADE, type Documento } from "@/lib/documento";
import { COR_SEVERIDADE, cssTexto, dataBr } from "@/lib/documento-formato";
import { COR_PADRAO, corLegivel } from "@/lib/marca";
import { PRAZO_DIAS } from "@/lib/prazos";

/**
 * Resumo executivo de UMA página para a diretoria: sem jargão técnico,
 * com o risco, os números, os 3 problemas mais graves em linguagem de
 * negócio, o andamento da correção e os próximos passos com prazo.
 */

const ROTULO_RISCO: Record<string, string> = {
  Critico: "Crítico",
  Alto: "Alto",
  Medio: "Médio",
  Baixo: "Baixo",
};

const COR_RISCO: Record<string, string> = {
  Critico: "var(--sev-critica)",
  Alto: "var(--sev-alta)",
  Medio: "var(--sev-media)",
  Baixo: "var(--sev-baixa)",
};

function primeiraFrase(texto: string, max = 220): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  const fim = limpo.search(/[.!?](\s|$)/);
  const frase = fim > 0 ? limpo.slice(0, fim + 1) : limpo;
  return frase.length > max ? `${frase.slice(0, max - 1)}…` : frase;
}

export function ResumoExecutivo({ doc }: { doc: Documento }) {
  const { relatorio, achados, marca, resumo } = doc;
  const { capa, sumarioExecutivo: sum } = relatorio;
  const cor = corLegivel(marca?.cor ?? COR_PADRAO);
  const autor = marca?.nome?.trim() || "Provafix";
  const maxSev = Math.max(1, ...ORDEM_SEVERIDADE.map((s) => resumo.porSeveridade[s]));
  const graves = [...achados]
    .sort(
      (a, b) =>
        ORDEM_SEVERIDADE.indexOf(a.severidade) - ORDEM_SEVERIDADE.indexOf(b.severidade) ||
        (Number.isFinite(b.cvss.score) ? b.cvss.score : 0) - (Number.isFinite(a.cvss.score) ? a.cvss.score : 0),
    )
    .filter((a) => a.verificacao?.status !== "verificado")
    .slice(0, 3);
  const pct = resumo.total ? Math.round((resumo.verificados / resumo.total) * 100) : 0;

  return (
    <div className="doc" style={{ ["--doc-cor" as string]: cor }}>
      <style>
        {`@page { size: A4; margin: 12mm 14mm; @bottom-left { content: ${cssTexto(
          `${autor} · resumo executivo · ${capa.classificacao}`,
        )}; font-size: 7.5pt; color: #64748b; } }`}
      </style>
      {doc.marcaDagua && (
        <div className="doc-marca-dagua" aria-hidden="true">
          Provafix Free
        </div>
      )}

      <section className="doc-folha" style={{ minHeight: "270mm" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          {marca?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL do logo da consultoria
            <img src={marca.logo} alt={autor} style={{ maxHeight: "14mm", maxWidth: "50mm", objectFit: "contain" }} />
          ) : (
            <span style={{ display: "flex", alignItems: "center", gap: 8, color: cor }}>
              <Logo className="h-9 w-9" />
              <strong style={{ color: "var(--doc-texto)" }}>{autor}</strong>
            </span>
          )}
          <span className="doc-rotulo">Resumo executivo · {capa.classificacao}</span>
        </div>

        <div style={{ borderBottom: `3px solid ${cor}`, padding: "10mm 0 5mm" }}>
          <p className="doc-rotulo">{capa.cliente}</p>
          <h1 style={{ fontSize: "20pt", fontWeight: 800, margin: "2mm 0" }}>{capa.titulo}</h1>
          <p className="doc-suave">
            Testes de {relatorio.escopoMetodologia.periodo || dataBr(capa.data)} · relatório v{capa.versao} de {dataBr(capa.data)}
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "8mm", marginTop: "7mm" }}>
          <div>
            <p className="doc-rotulo">Nível de risco</p>
            <p style={{ fontSize: "26pt", fontWeight: 800, color: COR_RISCO[sum.riscoGeral], margin: "1mm 0 3mm" }}>
              {ROTULO_RISCO[sum.riscoGeral] ?? sum.riscoGeral}
            </p>
            <p style={{ fontSize: "10.5pt" }}>{primeiraFrase(sum.visaoGeral, 320) || "—"}</p>
          </div>
          <div>
            <p className="doc-rotulo" style={{ marginBottom: 4 }}>
              {resumo.total} problema(s) encontrado(s)
            </p>
            {ORDEM_SEVERIDADE.map((s) => (
              <div className="doc-barra" key={s}>
                <span className="doc-barra-rotulo">{ROTULO_SEVERIDADE[s]}</span>
                <span className="doc-barra-trilho">
                  <span
                    style={{
                      display: "block",
                      height: "100%",
                      width: `${(resumo.porSeveridade[s] / maxSev) * 100}%`,
                      background: COR_SEVERIDADE[s],
                    }}
                  />
                </span>
                <span className="doc-barra-valor">{resumo.porSeveridade[s]}</span>
              </div>
            ))}
          </div>
        </div>

        <h2 style={{ marginTop: "8mm", fontSize: "13pt" }}>O que exige atenção primeiro</h2>
        {graves.length === 0 ? (
          <p>Nenhum problema em aberto: todos os achados foram corrigidos e comprovados em reteste.</p>
        ) : (
          <ol style={{ paddingLeft: 18 }}>
            {graves.map((a) => (
              <li key={a.id} style={{ marginBottom: "3mm" }}>
                <strong>{a.titulo}</strong>{" "}
                <span className={`doc-sev doc-sev-${a.severidade}`}>{ROTULO_SEVERIDADE[a.severidade]}</span>
                <br />
                <span>{primeiraFrase(a.impactoNegocio || a.descricaoTecnica) || "—"}</span>
                <br />
                <span className="doc-suave" style={{ fontSize: "9pt" }}>
                  Corrigir em até {PRAZO_DIAS[a.severidade]} dias
                  {a.prazo ? ` (até ${dataBr(a.prazo.venceEm)})` : ""}.
                </span>
              </li>
            ))}
          </ol>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: "6mm" }}>
          <div className="doc-kpi">
            <span className="doc-rotulo">Corrigidos e comprovados</span>
            <strong>{pct}%</strong>
            <span className="doc-suave" style={{ fontSize: "8.5pt" }}>
              {resumo.verificados} de {resumo.total}
            </span>
          </div>
          <div className="doc-kpi">
            <span className="doc-rotulo">Aguardando correção</span>
            <strong>{resumo.pendentes + resumo.naoCorrigidos}</strong>
            <span className="doc-suave" style={{ fontSize: "8.5pt" }}>
              {resumo.naoCorrigidos} falharam no reteste
            </span>
          </div>
          <div className="doc-kpi" style={resumo.atrasados ? { borderTopColor: "var(--sev-critica)" } : undefined}>
            <span className="doc-rotulo">Fora do prazo</span>
            <strong>{resumo.atrasados}</strong>
            <span className="doc-suave" style={{ fontSize: "8.5pt" }}>prazo por severidade</span>
          </div>
        </div>

        <h2 style={{ marginTop: "8mm", fontSize: "13pt" }}>Próximos passos</h2>
        <ol style={{ paddingLeft: 18 }}>
          {resumo.porSeveridade.Critica + resumo.porSeveridade.Alta > 0 && (
            <li>Priorizar os problemas críticos e altos ({PRAZO_DIAS.Critica} e {PRAZO_DIAS.Alta} dias).</li>
          )}
          <li>Encaminhar o relatório técnico ao time responsável pela correção.</li>
          <li>Agendar o reteste para comprovar as correções e emitir o certificado de correção.</li>
        </ol>

        <p className="doc-suave" style={{ fontSize: "8.5pt", marginTop: "8mm" }}>
          Detalhes técnicos, evidências e passos de correção estão no relatório completo. Preparado por{" "}
          {autor}
          {marca?.responsavel ? ` (${marca.responsavel})` : ""}
          {marca?.contato ? ` · ${marca.contato}` : ""}.
        </p>
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense, cache } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import db from "@/lib/db";
import {
  formatarHash,
  hashCertificado,
  progressoCertificado,
  type AchadoCertificado,
  type DadosCertificado,
} from "@/lib/certificado";
import { AcoesCertificado } from "@/components/certificado/AcoesCertificado";
import { SeverityBadge } from "@/components/SeverityBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { BarraProgresso } from "@/components/verificacao/PainelBase";
import { ROTULO_RESULTADO } from "@/lib/verificacao";
import type { ResultadoReteste, Severidade, StatusVerificacao } from "@/lib/tipos";

type Params = PageProps<"/certificado/[relatorioId]">["params"];

type LinhaRelatorio = {
  id: number;
  cliente: string;
  titulo: string;
  data: string;
  versao: string;
};

type LinhaAchado = {
  achado_ref: string;
  titulo: string;
  severidade: string;
  status: string;
  data_reteste: string | null;
  resultado: string | null;
};

const SEVERIDADES: Severidade[] = ["Critica", "Alta", "Media", "Baixa"];
const STATUS: StatusVerificacao[] = ["pendente", "verificado", "nao-corrigido"];
const RESULTADOS: ResultadoReteste[] = ["corrigido", "nao-corrigido", "parcial"];

type Certificado = {
  dados: DadosCertificado;
  progresso: ReturnType<typeof progressoCertificado>;
  hash: string;
};

/**
 * Carrega relatório + retestes numa única consulta por achado (subquery do
 * último reteste), calcula o progresso e o hash.
 *
 * `connection()` é obrigatório aqui: better-sqlite3 é síncrono e executaria
 * durante o prerender, congelando no build o estado do banco daquela hora.
 * A chamada também deixa `new Date()` fora da fase estática.
 */
const carregarCertificado = cache(async (id: number): Promise<Certificado | null> => {
  await connection();

  const relatorio = db
    .prepare("SELECT id, cliente, titulo, data, versao FROM relatorios WHERE id = ?")
    .get(id) as LinhaRelatorio | undefined;

  if (!relatorio) return null;

  const linhas = db
    .prepare(
      `SELECT a.achado_ref, a.titulo, a.severidade, a.status,
              (SELECT r.data_reteste FROM retestes r
                WHERE r.achado_id = a.id
                ORDER BY date(r.data_reteste) DESC, r.id DESC LIMIT 1) AS data_reteste,
              (SELECT r.resultado FROM retestes r
                WHERE r.achado_id = a.id
                ORDER BY date(r.data_reteste) DESC, r.id DESC LIMIT 1) AS resultado
         FROM achados_verificacao a
        WHERE a.relatorio_id = ?
        ORDER BY a.id`,
    )
    .all(id) as LinhaAchado[];

  const achados: AchadoCertificado[] = linhas.map((l) => ({
    ref: String(l.achado_ref),
    titulo: String(l.titulo),
    severidade: (SEVERIDADES.includes(l.severidade as Severidade)
      ? l.severidade
      : "Media") as Severidade,
    status: (STATUS.includes(l.status as StatusVerificacao)
      ? l.status
      : "pendente") as StatusVerificacao,
    dataReteste: l.data_reteste ? String(l.data_reteste) : null,
    resultado: (RESULTADOS.includes(l.resultado as ResultadoReteste)
      ? l.resultado
      : null) as ResultadoReteste | null,
  }));

  // Data de emissão derivada do dado gravado (último reteste, senão a data do
  // relatório) e não de `new Date()`: assim o hash continua conferível dias
  // depois — o certificado não muda de hash ao ser reaberto.
  const datasReteste = achados
    .map((a) => a.dataReteste)
    .filter((d): d is string => Boolean(d))
    .sort();
  const emitidoEm = datasReteste.at(-1) ?? relatorio.data;

  const dados: DadosCertificado = {
    relatorio: {
      id: Number(relatorio.id),
      cliente: relatorio.cliente,
      titulo: relatorio.titulo,
      data: relatorio.data,
      versao: relatorio.versao,
    },
    achados,
    emitidoEm,
  };

  return {
    dados,
    progresso: progressoCertificado(achados),
    hash: hashCertificado(dados),
  };
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { relatorioId } = await params;
  const id = Number(relatorioId);
  if (!Number.isInteger(id) || id <= 0) {
    return { title: "Certificado de correção — Laudo" };
  }

  const certificado = await carregarCertificado(id);
  if (!certificado) {
    return { title: "Certificado não encontrado — Laudo" };
  }

  const { relatorio } = certificado.dados;
  return {
    title: `Certificado de correção — ${relatorio.cliente} — Laudo`,
    description: `Evidência de que os ${certificado.progresso.total} achados do relatório "${relatorio.titulo}" foram retestados e corrigidos. Emitido em ${certificado.dados.emitidoEm}.`,
  };
}

export default function PaginaCertificado({ params }: { params: Params }) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
      <a
        href="/"
        className="no-print interativo inline-flex w-fit items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-texto-2 hover:text-accent"
      >
        ← laudo
      </a>

      <Suspense fallback={<CertificadoSkeleton />}>
        <CorpoCertificado params={params} />
      </Suspense>
    </div>
  );
}

async function CorpoCertificado({ params }: { params: Params }) {
  const { relatorioId } = await params;
  const id = Number(relatorioId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const certificado = await carregarCertificado(id);
  if (!certificado) notFound();

  if (certificado.progresso.total === 0) {
    return (
      <Pendencia titulo="Nada para certificar">
        Este relatório não tem achados verificáveis. Gere e salve o relatório com
        achados para liberar a verificação de correções.
      </Pendencia>
    );
  }

  if (!certificado.progresso.completo) {
    return <CertificadoPendente certificado={certificado} />;
  }

  return <CertificadoEmitido certificado={certificado} />;
}

/* ---------------------------------------------------------------
   Certificado emitido — documento imprimível, tudo numa página.
   --------------------------------------------------------------- */

function CertificadoEmitido({ certificado }: { certificado: Certificado }) {
  const { dados, progresso, hash } = certificado;

  return (
    <article className="print-detalhe overflow-hidden rounded-md border border-accent/40 bg-superficie">
      <header className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-accent/30 bg-superficie-2 px-5 py-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-accent">
          certificado #{dados.relatorio.id} · emitido em {dados.emitidoEm}
        </span>
        <AcoesCertificado hash={hash} />
      </header>

      <div className="flex flex-col gap-8 p-6 sm:p-10">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-accent">
              laudo · certificado de correção
            </p>
            <div className="mt-1.5 h-px w-16 bg-accent" />
            <h1 className="mt-5 max-w-2xl text-2xl font-bold leading-tight tracking-tight text-texto sm:text-3xl">
              {dados.relatorio.titulo}
            </h1>
            <p className="mt-2 text-sm text-texto-2">
              Relatório de teste de intrusão · v{dados.relatorio.versao} ·{" "}
              {dados.relatorio.data}
            </p>
          </div>

          <div className="rounded-md border border-accent/40 bg-accent/10 px-5 py-4 text-center">
            <span aria-hidden="true" className="font-mono text-2xl text-accent">
              ✓
            </span>
            <p className="font-mono text-2xl font-bold text-accent">100%</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-accent/80">
              verificado
            </p>
          </div>
        </div>

        <p className="max-w-3xl text-sm leading-relaxed text-texto">
          Certificamos que os{" "}
          <strong className="font-semibold text-accent">
            {progresso.total} achado{progresso.total === 1 ? "" : "s"}
          </strong>{" "}
          de segurança do relatório acima, identificados pelo cliente{" "}
          <strong className="font-semibold">{dados.relatorio.cliente}</strong>,
          foram submetidos a reteste e confirmados como corrigidos.
        </p>

        <dl className="grid grid-cols-2 gap-x-8 gap-y-5 border-t border-borda pt-6 sm:grid-cols-4">
          <Dado rotulo="cliente" valor={dados.relatorio.cliente} />
          <Dado rotulo="relatório" valor={`#${dados.relatorio.id}`} />
          <Dado rotulo="emitido em" valor={dados.emitidoEm} mono />
          <Dado
            rotulo="achados corrigidos"
            valor={`${progresso.verificados}/${progresso.total}`}
            mono
          />
        </dl>

        <section>
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
            achados corrigidos
          </h2>
          <ul className="mt-3 flex flex-col divide-y divide-borda rounded-md border border-borda">
            {dados.achados.map((achado) => (
              <li
                key={achado.ref}
                className="print-detalhe flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
              >
                <span className="font-mono text-[10px] tracking-wider text-texto-2">
                  {achado.ref}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-texto">
                  {achado.titulo}
                </span>
                <SeverityBadge severidade={achado.severidade} />
                <span className="font-mono text-[11px] text-texto-2">
                  reteste {achado.dataReteste} ·{" "}
                  {achado.resultado ? ROTULO_RESULTADO[achado.resultado] : "corrigido"}
                </span>
                <StatusBadge status={achado.status} />
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-md border border-borda bg-superficie-2 p-4">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
            hash de verificação · sha-256
          </h2>
          <p className="mt-2 font-mono text-sm break-all text-accent">
            {formatarHash(hash)}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-texto-2">
            O hash cobre relatório, achados, datas de reteste e a data de emissão.
            Recalcular sobre os mesmos dados deve devolver exatamente este valor.
          </p>
        </section>

        <footer className="flex flex-wrap items-end justify-between gap-6 border-t border-borda pt-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
              emitido por
            </p>
            <p className="mt-1 text-sm font-medium text-texto">Laudo</p>
            <p className="font-mono text-[11px] text-texto-2">
              assurance de pentest · v0.2
            </p>
          </div>
          <p className="max-w-sm text-right text-xs leading-relaxed text-texto-2">
            Documento gerado a partir dos retestes registrados na plataforma. A
            autenticidade se confere pelo hash acima.
          </p>
        </footer>
      </div>
    </article>
  );
}

function Dado({ rotulo, valor, mono }: { rotulo: string; valor: string; mono?: boolean }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
        {rotulo}
      </dt>
      <dd
        className={`mt-1 truncate text-sm font-medium text-texto ${mono ? "font-mono" : ""}`}
      >
        {valor}
      </dd>
    </div>
  );
}

/* ---------------------------------------------------------------
   Ainda não emitido — mostra o que falta, sem prometer o selo.
   --------------------------------------------------------------- */

function CertificadoPendente({ certificado }: { certificado: Certificado }) {
  const { dados, progresso } = certificado;
  const faltam = dados.achados.filter((a) => a.status !== "verificado");

  return (
    <article className="overflow-hidden rounded-md border border-borda bg-superficie">
      <header className="border-b border-borda bg-superficie-2 px-5 py-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-media">
          certificado #{dados.relatorio.id} · aguardando retestes
        </span>
      </header>

      <div className="flex flex-col gap-6 p-6 sm:p-8">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-texto">
            Certificado ainda não emitido
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-texto-2">
            O certificado de correção do relatório “{dados.relatorio.titulo}” só é
            emitido quando todos os achados estão verificados. Restam{" "}
            {faltam.length} de {progresso.total}.
          </p>
        </div>

        <BarraProgresso verificados={progresso.verificados} total={progresso.total} />

        <ul className="flex flex-col divide-y divide-borda rounded-md border border-borda">
          {faltam.map((achado) => (
            <li
              key={achado.ref}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
            >
              <span className="font-mono text-[10px] tracking-wider text-texto-2">
                {achado.ref}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-texto">
                {achado.titulo}
              </span>
              <SeverityBadge severidade={achado.severidade} />
              <StatusBadge status={achado.status} />
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/"
            className="interativo inline-flex cursor-pointer items-center justify-center rounded-md border border-accent px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-accent hover:bg-accent hover:text-fundo"
          >
            concluir a verificação
          </a>
          <span className="font-mono text-[11px] text-texto-2">
            {progresso.percentual}% do caminho
          </span>
        </div>
      </div>
    </article>
  );
}

function Pendencia({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <article className="rounded-md border border-dashed border-borda bg-superficie/60 px-6 py-12 text-center">
      <span aria-hidden="true" className="font-mono text-2xl text-texto-2">
        ◇
      </span>
      <h1 className="mt-3 text-base font-semibold text-texto">{titulo}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-texto-2">
        {children}
      </p>
      <a
        href="/"
        className="interativo mt-6 inline-flex cursor-pointer items-center justify-center rounded-md border border-accent px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-accent hover:bg-accent hover:text-fundo"
      >
        voltar
      </a>
    </article>
  );
}

function CertificadoSkeleton() {
  return (
    <div
      role="status"
      aria-label="Carregando certificado"
      className="flex flex-col gap-4 rounded-md border border-borda bg-superficie p-6 sm:p-10"
    >
      <div className="h-3 w-40 animate-pulse rounded-sm bg-borda" />
      <div className="h-7 w-2/3 animate-pulse rounded-sm bg-borda" />
      <div className="h-3 w-1/2 animate-pulse rounded-sm bg-borda/60" />
      <div className="mt-4 h-32 w-full animate-pulse rounded-md bg-borda/50" />
      <div className="h-16 w-full animate-pulse rounded-md bg-borda/40" />
    </div>
  );
}

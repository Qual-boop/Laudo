import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense, cache } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { normalizarPlano } from "@/lib/planos";
import {
  carregarDadosCertificado,
  donoDoRelatorio,
  type Certificado,
} from "@/lib/certificado-dados";
import { progressoCertificado } from "@/lib/certificado";
import { tokenPublicoDe } from "@/lib/certificado-publico";
import { AcoesCertificado } from "@/components/certificado/AcoesCertificado";
import { DocumentoCertificado } from "@/components/certificado/DocumentoCertificado";
import { SeverityBadge } from "@/components/SeverityBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { BarraProgresso } from "@/components/verificacao/PainelBase";
import type { ResultadoReteste, Severidade, StatusVerificacao } from "@/lib/tipos";

type Params = PageProps<"/certificado/[relatorioId]">["params"];

/**
 * Lib pura carrega os dados; aqui só envolvemos com `cache` + `connection()`.
 * `connection()` é obrigatório: better-sqlite3 é síncrono e executaria
 * durante o prerender, congelando no build o estado do banco daquela hora.
 */
const carregarCertificado = cache(async (id: number): Promise<Certificado | null> => {
  await connection();
  return carregarDadosCertificado(id);
});

/** true só se o visitante logado é o dono do relatório (fail-closed). */
async function visitanteEDono(id: number): Promise<boolean> {
  const sessao = await auth();
  const visitante = Number(sessao?.user?.id);
  if (!Number.isInteger(visitante) || visitante <= 0) return false;
  return (await donoDoRelatorio(id)) === visitante;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { relatorioId } = await params;
  const id = Number(relatorioId);
  if (!Number.isInteger(id) || id <= 0) {
    return { title: "Certificado de correção — Provafix" };
  }

  // Sem dono, sem metadados: o <title> vazaria cliente/título alheios.
  if (!(await visitanteEDono(id))) {
    return { title: "Certificado de correção — Provafix" };
  }

  const certificado = await carregarCertificado(id);
  if (!certificado) {
    return { title: "Certificado não encontrado — Provafix" };
  }

  const { relatorio } = certificado.dados;
  return {
    title: `Certificado de correção — ${relatorio.cliente} — Provafix`,
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

  // Certificado é privado: só o dono vê (404 para não vazar existência).
  if (!(await visitanteEDono(id))) notFound();

  // Certificado é recurso Pro/Team: free vê o bloqueio com upgrade.
  const sessao = await auth();
  const plano = normalizarPlano(
    (sessao?.user as { plano?: unknown } | undefined)?.plano,
  );
  if (plano === "free") {
    return (
      <Pendencia
        titulo="Certificado disponível nos planos Pro e Team"
        cta={{ rotulo: "ver planos", href: "/precos" }}
      >
        O certificado de correção com hash de verificação é um recurso pago.
        Faça upgrade para emitir certificados dos seus relatórios.
      </Pendencia>
    );
  }

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

  const token = await tokenPublicoDe(id);
  return (
    <DocumentoCertificado
      certificado={certificado}
      acoes={
        <AcoesCertificado
          hash={certificado.hash}
          linkPublico={{ relatorioId: id, token }}
        />
      }
    />
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
            href="/painel"
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

function Pendencia({
  titulo,
  children,
  cta = { rotulo: "voltar", href: "/painel" },
}: {
  titulo: string;
  children: ReactNode;
  cta?: { rotulo: string; href: string };
}) {
  return (
    <article className="rounded-lg border border-dashed border-borda bg-superficie/60 px-6 py-14 text-center">
      <span aria-hidden="true" className="font-mono text-2xl text-texto-2">
        ◇
      </span>
      <h1 className="mt-3 text-base font-semibold text-texto">{titulo}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-texto-2">
        {children}
      </p>
      <a
        href={cta.href}
        className="interativo mt-6 inline-flex cursor-pointer items-center justify-center rounded-lg border border-accent px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-accent hover:bg-accent hover:text-fundo"
      >
        {cta.rotulo}
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
      <div className="h-3 w-40 shimmer rounded-sm bg-borda" />
      <div className="h-7 w-2/3 shimmer rounded-sm bg-borda" />
      <div className="h-3 w-1/2 shimmer rounded-sm bg-borda/60" />
      <div className="mt-4 h-32 w-full shimmer rounded-md bg-borda/50" />
      <div className="h-16 w-full shimmer rounded-md bg-borda/40" />
    </div>
  );
}

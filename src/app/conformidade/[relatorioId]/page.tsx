import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { BotaoImprimir } from "@/components/BotaoImprimir";
import { donoDoRelatorio } from "@/lib/certificado-dados";
import {
  AVISO_CONFORMIDADE,
  contarEstados,
  montarQuadro,
  type EstadoEvidencia,
} from "@/lib/conformidade";
import { carregarDadosConformidade } from "@/lib/conformidade-dados";
import { normalizarPlano } from "@/lib/planos";

type Params = PageProps<"/conformidade/[relatorioId]">["params"];

export const metadata: Metadata = {
  title: "Quadro de conformidade",
  robots: { index: false, follow: false },
};

const ESTILO: Record<EstadoEvidencia, { rotulo: string; classe: string }> = {
  evidenciado: { rotulo: "evidenciado", classe: "border-accent/50 bg-accent/10 text-accent" },
  parcial: { rotulo: "parcial", classe: "border-media/50 bg-media/10 text-media" },
  "sem-evidencia": { rotulo: "sem evidência", classe: "border-critica/50 bg-critica/10 text-critica" },
};

export default function PaginaConformidade({ params }: { params: Params }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
      <a
        href="/painel"
        className="no-print interativo inline-flex w-fit items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-texto-2 hover:text-accent"
      >
        ← painel
      </a>
      <Suspense fallback={<p className="font-mono text-xs text-texto-2">montando quadro…</p>}>
        <Corpo params={params} />
      </Suspense>
    </div>
  );
}

async function Corpo({ params }: { params: Params }) {
  await connection();
  const { relatorioId } = await params;
  const id = Number(relatorioId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const sessao = await auth();
  const visitante = Number(sessao?.user?.id);
  if (!Number.isInteger(visitante) || (await donoDoRelatorio(id)) !== visitante) notFound();

  const plano = normalizarPlano((sessao?.user as { plano?: unknown } | undefined)?.plano);
  if (plano === "free") {
    return (
      <article className="rounded-md border border-borda bg-superficie p-6">
        <h1 className="text-xl font-bold text-texto">Quadro de conformidade nos planos Pro e Team</h1>
        <p className="mt-2 text-sm text-texto-2">
          Organize as evidências do pentest e do reteste por requisito de PCI DSS, ISO 27001, LGPD e Banco
          Central.
        </p>
        <a href="/precos" className="mt-4 inline-block font-mono text-xs uppercase tracking-wider text-accent">
          ver planos →
        </a>
      </article>
    );
  }

  const dados = await carregarDadosConformidade(id);
  if (!dados) notFound();
  const marcos = montarQuadro(dados);
  const totais = contarEstados(marcos);

  return (
    <article className="print-detalhe overflow-hidden rounded-md border border-borda bg-superficie">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-borda bg-superficie-2 px-5 py-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-accent">
          quadro de conformidade · relatório #{id}
        </span>
        <BotaoImprimir />
      </header>

      <div className="flex flex-col gap-8 p-6 sm:p-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-texto sm:text-3xl">{dados.titulo}</h1>
          <p className="mt-1 text-sm text-texto-2">
            {dados.cliente} · relatório de {dados.data.split("-").reverse().join("/")}
          </p>
          <div className="mt-5 flex flex-wrap gap-2 font-mono text-[11px]">
            {(Object.keys(totais) as EstadoEvidencia[]).map((e) => (
              <span key={e} className={`rounded-sm border px-2 py-0.5 ${ESTILO[e].classe}`}>
                {totais[e]} {ESTILO[e].rotulo}
              </span>
            ))}
          </div>
        </div>

        <p className="rounded-md border border-borda bg-superficie-2 p-4 text-xs leading-relaxed text-texto-2">
          {AVISO_CONFORMIDADE}
        </p>

        {marcos.map((m) => (
          <section key={m.id} className="print-detalhe">
            <h2 className="text-base font-semibold text-texto">{m.nome}</h2>
            {m.nota && <p className="mt-1 text-xs leading-relaxed text-texto-2">{m.nota}</p>}
            <div className="mt-3 overflow-x-auto rounded-md border border-borda">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-borda font-mono text-[10px] uppercase tracking-widest text-texto-2">
                    <th scope="col" className="w-28 px-4 py-2.5 font-normal">ref.</th>
                    <th scope="col" className="px-4 py-2.5 font-normal">requisito</th>
                    <th scope="col" className="px-4 py-2.5 font-normal">evidência no Provafix</th>
                    <th scope="col" className="w-32 px-4 py-2.5 font-normal">estado</th>
                  </tr>
                </thead>
                <tbody>
                  {m.itens.map((i) => (
                    <tr key={i.referencia} className="border-b border-borda align-top last:border-0">
                      <th scope="row" className="px-4 py-3 font-mono text-xs font-medium text-texto">
                        {i.referencia}
                      </th>
                      <td className="px-4 py-3 text-texto">{i.requisito}</td>
                      <td className="px-4 py-3 text-texto-2">{i.evidencia}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase ${ESTILO[i.estado].classe}`}>
                          {ESTILO[i.estado].rotulo}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        <footer className="border-t border-borda pt-5 font-mono text-[11px] text-texto-2">
          Gerado pelo Provafix a partir do relatório #{id} e dos retestes registrados.
        </footer>
      </div>
    </article>
  );
}

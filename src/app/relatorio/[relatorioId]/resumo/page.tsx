import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { BarraDocumento } from "@/components/documento/BarraDocumento";
import { ResumoExecutivo } from "@/components/documento/ResumoExecutivo";
import { papelNoRelatorio } from "@/lib/acesso";
import { carregarDocumento } from "@/lib/documento";
import { nomeArquivo } from "@/lib/documento-formato";

type Params = PageProps<"/relatorio/[relatorioId]/resumo">["params"];

export const metadata: Metadata = {
  title: "Resumo executivo",
  robots: { index: false, follow: false },
};

/** /relatorio/[id]/resumo — 1 página para a diretoria (Pro e Team). */
export default function PaginaResumo({ params }: { params: Params }) {
  return (
    <div className="doc-fundo">
      <Suspense fallback={<p style={{ textAlign: "center", color: "#475569" }}>montando o resumo…</p>}>
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
  if (!Number.isInteger(visitante) || !(await papelNoRelatorio(visitante, id))) notFound();

  const doc = await carregarDocumento(id);
  if (!doc) notFound();

  if (doc.planoDono === "free") {
    return (
      <div className="doc" style={{ textAlign: "center", paddingTop: 60 }}>
        <section className="doc-folha" style={{ maxWidth: 520 }}>
          <h1 style={{ fontSize: "16pt" }}>Resumo executivo nos planos Pro e Team</h1>
          <p className="doc-suave" style={{ marginTop: 10 }}>
            Uma página em linguagem de negócio para a diretoria: risco, números, o que corrigir primeiro e
            em quanto tempo — com a marca da sua consultoria.
          </p>
          <p style={{ marginTop: 16 }}>
            <a href="/precos" style={{ color: "#047857", fontWeight: 700 }}>ver planos →</a>
          </p>
        </section>
      </div>
    );
  }

  return (
    <>
      <BarraDocumento
        nomeArquivo={nomeArquivo("Resumo-executivo", doc.relatorio.capa.cliente, doc.relatorio.capa.data)}
        voltar="/painel"
        links={[{ href: `/relatorio/${id}/pdf`, rotulo: "relatório completo" }]}
      />
      <ResumoExecutivo doc={doc} />
    </>
  );
}

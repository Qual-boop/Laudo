import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { BarraDocumento } from "@/components/documento/BarraDocumento";
import { DocumentoRelatorio } from "@/components/documento/DocumentoRelatorio";
import { papelNoRelatorio } from "@/lib/acesso";
import { carregarDocumento } from "@/lib/documento";
import { nomeArquivo } from "@/lib/documento-formato";

type Params = PageProps<"/relatorio/[relatorioId]/pdf">["params"];

export const metadata: Metadata = {
  title: "Relatório (PDF)",
  robots: { index: false, follow: false },
};

/** /relatorio/[id]/pdf — o relatório final pronto para "Salvar como PDF". */
export default function PaginaPdf({ params }: { params: Params }) {
  return (
    <div className="doc-fundo">
      <Suspense fallback={<p style={{ textAlign: "center", color: "#475569" }}>montando o documento…</p>}>
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

  return (
    <>
      <BarraDocumento
        nomeArquivo={nomeArquivo("Pentest", doc.relatorio.capa.cliente, doc.relatorio.capa.data)}
        voltar="/painel"
        links={[{ href: `/relatorio/${id}/resumo`, rotulo: "resumo executivo" }]}
      />
      <DocumentoRelatorio doc={doc} />
    </>
  );
}

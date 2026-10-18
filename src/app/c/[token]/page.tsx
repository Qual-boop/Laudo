import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { certificadoPorToken } from "@/lib/certificado-publico";
import { AcoesCertificado } from "@/components/certificado/AcoesCertificado";
import { DocumentoCertificado } from "@/components/certificado/DocumentoCertificado";
import { REPOSITORIO, URL_SITE } from "@/lib/site";

type Params = PageProps<"/c/[token]">["params"];

/**
 * Link público do certificado — o cliente final abre sem login.
 *
 * Somente leitura e sem dados de conta: mostra o mesmo documento da página
 * do dono, mais o caminho para recalcular o hash. 404 para token inválido,
 * revogado ou certificado que deixou de valer (lib/certificado-publico.ts).
 *
 * Metadados fixos de propósito: o <title> não depende do token, então
 * prévia de link e histórico não carregam cliente nem título do relatório.
 */
export const metadata: Metadata = {
  title: "Certificado de correção", // o layout acrescenta "| Laudo"
  description: "Certificado de correção de pentest emitido pelo Laudo.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function PaginaCertificadoPublico({ params }: { params: Params }) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
      <a
        href="/"
        className="no-print interativo inline-flex w-fit items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-texto-2 hover:text-accent"
      >
        ← laudo
      </a>

      <Suspense fallback={<CertificadoSkeleton />}>
        <CorpoCertificadoPublico params={params} />
      </Suspense>
    </div>
  );
}

async function CorpoCertificadoPublico({ params }: { params: Params }) {
  const { token } = await params;
  // Mesmo motivo da página do dono: sem isso o banco seria lido no prerender.
  await connection();

  const certificado = await certificadoPorToken(token);
  if (!certificado) notFound();

  const arquivo = `certificado-${certificado.dados.relatorio.id}.json`;
  const caminhoJson = `/c/${token}/json`;

  return (
    <DocumentoCertificado
      certificado={certificado}
      acoes={<AcoesCertificado hash={certificado.hash} />}
    >
      <div className="mt-4 border-t border-borda pt-4 text-xs leading-relaxed text-texto-2">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-texto-2">
          como recalcular
        </h3>
        <p className="mt-2">
          O hash é o SHA-256 do{" "}
          <a href={caminhoJson} download={arquivo} className="text-accent hover:underline">
            JSON canônico deste certificado
          </a>{" "}
          (UTF-8, chaves em ordem alfabética, sem espaços, achados ordenados pela
          referência). Baixe o arquivo e calcule:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-sm border border-borda bg-fundo px-3 py-2 font-mono text-[11px] text-texto">
          {`# Linux / macOS
curl -s ${URL_SITE}${caminhoJson} | sha256sum

# Windows (PowerShell), com o arquivo baixado
Get-FileHash ${arquivo} -Algorithm SHA256`}
        </pre>
        <p className="mt-2">
          O resultado deve ser igual ao hash acima, sem os espaços entre os
          blocos (o PowerShell mostra em maiúsculas). O código que monta o JSON e calcula o hash é aberto:{" "}
          <a
            href={`${REPOSITORIO}/blob/main/src/lib/certificado.ts`}
            className="text-accent hover:underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            src/lib/certificado.ts
          </a>
          .
        </p>
      </div>
    </DocumentoCertificado>
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

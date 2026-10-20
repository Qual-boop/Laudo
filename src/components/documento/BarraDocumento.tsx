"use client";

import { useEffect } from "react";

/**
 * Barra fixa acima do documento (não sai na impressão): voltar, outros
 * documentos e "Baixar PDF". O título da aba vira o nome sugerido do
 * arquivo na janela "Salvar como PDF".
 */
export function BarraDocumento({
  nomeArquivo,
  voltar,
  links = [],
}: {
  nomeArquivo: string;
  voltar: string;
  links?: { href: string; rotulo: string }[];
}) {
  useEffect(() => {
    const anterior = document.title;
    document.title = nomeArquivo;
    return () => {
      document.title = anterior;
    };
  }, [nomeArquivo]);

  return (
    <div className="doc-barra-ferramentas">
      <span style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <a href={voltar}>← voltar</a>
        {links.map((l) => (
          <a key={l.href} href={l.href}>
            {l.rotulo}
          </a>
        ))}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ color: "#94a3b8", fontSize: 12 }}>
          Na janela de impressão, escolha <strong>Salvar como PDF</strong>.
        </span>
        <button type="button" className="doc-botao" onClick={() => window.print()}>
          Baixar PDF
        </button>
      </span>
    </div>
  );
}

import { Logo } from "@/components/Logo";
import { formatarHash } from "@/lib/certificado";
import { CERTIFICADO_EXEMPLO, HASH_EXEMPLO } from "@/lib/certificado-exemplo";

/* Cores da versão impressa (mesmas do @media print do globals.css). */
const SEVERIDADE = {
  Critica: ["Crítica", "text-[#b91c1c]"],
  Alta: ["Alta", "text-[#c2410c]"],
  Media: ["Média", "text-[#a16207]"],
  Baixa: ["Baixa", "text-[#1d4ed8]"],
} as const;

function dataBr(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function Dado({ rotulo, valor, mono }: { rotulo: string; valor: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#64748b]">
        {rotulo}
      </dt>
      <dd className={`mt-1 truncate text-sm font-medium text-[#0f172a] ${mono ? "font-mono" : ""}`}>
        {valor}
      </dd>
    </div>
  );
}

/** Selo circular: texto em volta + check do logo no centro. */
function Selo() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" className="h-24 w-24 shrink-0 text-[#047857]">
      <defs>
        <path id="lp-selo-circulo" d="M60,60 m-45,0 a45,45 0 1,1 90,0 a45,45 0 1,1 -90,0" />
      </defs>
      <circle cx="60" cy="60" r="57" fill="none" stroke="currentColor" strokeOpacity="0.3" />
      <circle cx="60" cy="60" r="35" fill="currentColor" fillOpacity="0.07" stroke="currentColor" strokeOpacity="0.45" />
      <text fill="currentColor" fontSize="8.6" letterSpacing="2.6" style={{ fontFamily: "var(--font-mono)" }}>
        <textPath href="#lp-selo-circulo">VERIFICADO · 100% CORRIGIDO ·</textPath>
      </text>
      <path d="M46 61l9.5 8.5L75 47" fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * O certificado como o cliente recebe (versão PDF/impressão, fundo claro).
 * Dados fictícios — mas o hash é o SHA-256 real deles.
 */
export function CertificadoExemplo() {
  const { relatorio, achados, emitidoEm } = CERTIFICADO_EXEMPLO;
  const total = achados.length;

  return (
    <article
      aria-label="Exemplo de certificado de correção"
      className="lp-papel relative overflow-hidden rounded-xl shadow-[0_50px_120px_-40px_rgba(0,0,0,0.9)]"
    >
      <div aria-hidden="true" className="lp-guilhoche pointer-events-none absolute inset-0" />
      <div className="relative m-2 rounded-lg border border-[#0f172a]/10 p-6 sm:m-3 sm:p-10">
        <span className="absolute right-4 top-4 rounded-full border border-[#0f172a]/15 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#64748b] sm:right-6 sm:top-6">
          exemplo
        </span>

        <header className="flex items-center gap-3">
          <Logo className="h-8 w-8 text-[#047857]" />
          <div>
            <p className="text-sm font-semibold tracking-tight text-[#0f172a]">Laudo</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#64748b]">
              certificado de correção
            </p>
          </div>
        </header>

        <h3 className="mt-8 font-serif text-[2rem] leading-[1.1] text-[#0f172a] sm:text-[2.6rem]">
          {relatorio.titulo}
        </h3>
        <p className="mt-2 text-sm text-[#475569]">
          Relatório de teste de intrusão · v{relatorio.versao} · {dataBr(relatorio.data)}
        </p>

        <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-[#1e293b]">
          Certificamos que os <strong className="font-semibold text-[#047857]">{total} achados</strong>{" "}
          de segurança do relatório acima, do cliente{" "}
          <strong className="font-semibold">{relatorio.cliente}</strong>, foram submetidos a
          reteste e confirmados como corrigidos.
        </p>

        <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-[#0f172a]/10 pt-6 sm:grid-cols-4">
          <Dado rotulo="cliente" valor={relatorio.cliente} />
          <Dado rotulo="relatório" valor={`#${relatorio.id}`} mono />
          <Dado rotulo="emitido em" valor={dataBr(emitidoEm)} mono />
          <Dado rotulo="corrigidos" valor={`${total}/${total}`} mono />
        </dl>

        <table className="mt-8 w-full border-collapse text-left text-sm">
          <caption className="sr-only">Achados corrigidos</caption>
          <thead>
            <tr className="border-b border-[#0f172a]/10 font-mono text-[10px] uppercase tracking-[0.16em] text-[#64748b]">
              <th scope="col" className="hidden py-2 pr-4 font-normal sm:table-cell">ref</th>
              <th scope="col" className="py-2 pr-3 font-normal sm:pr-4">achado</th>
              <th scope="col" className="py-2 pr-3 font-normal sm:pr-4">severidade</th>
              <th scope="col" className="py-2 font-normal">reteste</th>
            </tr>
          </thead>
          <tbody>
            {achados.map((a) => {
              const [rotulo, cor] = SEVERIDADE[a.severidade];
              return (
                <tr key={a.ref} className="border-b border-[#0f172a]/[0.07] last:border-0">
                  <td className="hidden py-3 pr-4 font-mono text-[11px] text-[#64748b] sm:table-cell">
                    {a.ref}
                  </td>
                  <th scope="row" className="py-3 pr-3 font-normal text-[#0f172a] sm:pr-4">
                    {a.titulo}
                  </th>
                  <td className={`py-3 pr-3 font-medium sm:pr-4 ${cor}`}>{rotulo}</td>
                  <td className="whitespace-nowrap py-3 font-mono text-[11px] text-[#475569]">
                    <span className="text-[#047857]">
                      ✓<span className="hidden sm:inline"> corrigido</span>
                    </span>{" "}
                    {a.dataReteste && (
                      <>
                        <span className="sm:hidden">{dataBr(a.dataReteste).slice(0, 5)}</span>
                        <span className="hidden sm:inline">{dataBr(a.dataReteste)}</span>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-8 flex flex-col gap-6 border-t border-[#0f172a]/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#64748b]">
              hash de verificação · sha-256
            </p>
            <p className="mt-2 max-w-md font-mono text-[13px] leading-relaxed text-[#047857]">
              {formatarHash(HASH_EXEMPLO)}
            </p>
            <p className="mt-2 max-w-md text-xs leading-relaxed text-[#64748b]">
              Cobre relatório, achados, datas de reteste e a data de emissão.
              Recalcular sobre os mesmos dados devolve exatamente este valor.
            </p>
          </div>
          <Selo />
        </div>
      </div>
    </article>
  );
}

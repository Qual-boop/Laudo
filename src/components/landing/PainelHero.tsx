import { Logo } from "@/components/Logo";
import { Icone } from "@/components/landing/Icone";
import { formatarHash } from "@/lib/certificado";
import { CERTIFICADO_EXEMPLO, HASH_EXEMPLO } from "@/lib/certificado-exemplo";

const COR_SEVERIDADE = {
  Critica: ["Crítica", "text-critica"],
  Alta: ["Alta", "text-alta"],
  Media: ["Média", "text-media"],
  Baixa: ["Baixa", "text-baixa"],
} as const;

function dataCurta(iso: string) {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

/**
 * Composição do hero: painel de verificação concluído + o certificado
 * que ele libera. Estático (sem estado): o conteúdo aparece mesmo sem
 * animação/JS — as animações só refinam (barra e flutuação).
 */
export function PainelHero() {
  const { relatorio, achados, emitidoEm } = CERTIFICADO_EXEMPLO;
  const [ano, mes, dia] = emitidoEm.split("-");
  const blocosHash = formatarHash(HASH_EXEMPLO).split(" ");

  return (
    <div className="relative mx-auto w-full max-w-[34rem] pb-14 lg:mx-0 lg:ml-auto">
      <div aria-hidden="true" className="lp-aura absolute -inset-8 -z-10" />

      <figure className="lp-painel overflow-hidden rounded-2xl">
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-3.5">
          <span aria-hidden="true" className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
          </span>
          <span className="truncate font-mono text-[11px] text-texto-2">
            acme · pentest web · v{relatorio.versao}
          </span>
          <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent/[0.1] px-2.5 py-1 font-mono text-[10px] text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            reteste concluído
          </span>
        </div>

        <div className="px-5 pb-3 pt-5">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium text-texto">
              {achados.length} de {achados.length} achados verificados
            </p>
            <p className="font-mono text-xs text-accent">100%</p>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="lp-progresso h-full w-full rounded-full bg-accent" />
          </div>

          <ul className="mt-4 divide-y divide-white/[0.06]">
            {achados.map((a) => {
              const [rotulo, cor] = COR_SEVERIDADE[a.severidade];
              return (
                <li key={a.ref} className="flex items-center gap-3 py-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/[0.12] text-accent">
                    <Icone nome="check" className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-texto">{a.titulo}</p>
                    <p className="font-mono text-[11px] text-texto-2">
                      {a.ref} · <span className={cor}>{rotulo}</span>
                    </p>
                  </div>
                  {a.dataReteste && (
                    <span className="hidden shrink-0 font-mono text-[11px] text-texto-2 sm:block">
                      reteste {dataCurta(a.dataReteste)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </figure>

      {/* O que o painel libera: o certificado, já no formato de entrega. */}
      <div className="lp-flutuar lp-papel absolute -bottom-1 right-3 w-60 rotate-[-2.5deg] rounded-lg p-4 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.85)] sm:-right-6 sm:w-64">
        <div className="flex items-center gap-2">
          <Logo className="h-5 w-5 text-[#047857]" />
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#475569]">
            certificado de correção
          </span>
        </div>
        <p className="mt-2.5 font-serif text-[1.35rem] leading-tight text-[#0f172a]">
          {relatorio.cliente.replace(" Ltda.", "")}
        </p>
        <p className="mt-0.5 text-[11px] text-[#475569]">
          {achados.length}/{achados.length} achados corrigidos · {dia}/{mes}/{ano}
        </p>
        <p className="mt-3 font-mono text-[9.5px] leading-relaxed text-[#047857]">
          sha-256 {blocosHash.slice(0, 3).join(" ")}…
        </p>
      </div>
    </div>
  );
}

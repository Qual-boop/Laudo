import { Button } from "@/components/Button";
import { SeverityBadge } from "@/components/SeverityBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { AcoesExportacaoAchado } from "@/components/verificacao/AcoesExportacaoAchado";
import { ROTULO_RESULTADO } from "@/lib/verificacao";
import type { AchadoVerificavel, StatusVerificacao } from "@/lib/tipos";

type Props = {
  achado: AchadoVerificavel;
  onRegistrar: (achado: AchadoVerificavel) => void;
  onVerDelta: (achado: AchadoVerificavel) => void;
  onCopiar: (texto: string, rotulo: string) => void;
};

/* ---------------------------------------------------------------
   Ícone de status. O glifo carrega o estado mesmo em preto e
   branco — não depende só da cor.
   --------------------------------------------------------------- */
const ICONE: Record<StatusVerificacao, { glifo: string; classe: string }> = {
  verificado: { glifo: "✓", classe: "bg-accent/15 text-accent" },
  "nao-corrigido": { glifo: "✗", classe: "bg-critica/15 text-critica" },
  pendente: { glifo: "○", classe: "bg-media/15 text-media" },
};

function dataCurta(iso: string | null): string | null {
  if (!iso) return null;
  const p = iso.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}

/** "há 3 dias" a partir de uma data ISO. */
export function tempoRelativo(iso: string | null, agora = new Date()): string | null {
  if (!iso) return null;
  const alvo = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(alvo.getTime())) return null;

  const dias = Math.floor(
    (Date.UTC(
      agora.getFullYear(),
      agora.getMonth(),
      agora.getDate(),
    ) -
      Date.UTC(alvo.getFullYear(), alvo.getMonth(), alvo.getDate())) /
      86_400_000,
  );

  if (dias < 0) return "agendado";
  if (dias === 0) return "hoje";
  if (dias === 1) return "há 1 dia";
  if (dias < 30) return `há ${dias} dias`;

  const meses = Math.floor(dias / 30);
  return meses === 1 ? "há 1 mês" : `há ${meses} meses`;
}

export function AchadoVerificacaoCard({ achado, onRegistrar, onVerDelta, onCopiar }: Props) {
  const reteste = achado.ultimo_reteste;
  const icone = ICONE[achado.status];

  const quando = reteste
    ? tempoRelativo(reteste.data_reteste)
    : achado.data_reteste_sugerida
      ? tempoRelativo(achado.data_reteste_sugerida)
      : null;

  return (
    <article className="interativo rounded-md border border-borda bg-superficie hover:border-texto-2/40">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            aria-hidden="true"
            title={achado.status}
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-[11px] ${icone.classe}`}
          >
            {icone.glifo}
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] tracking-wider text-accent">
                {achado.achado_ref}
              </span>
              <SeverityBadge severidade={achado.severidade} />
              <StatusBadge status={achado.status} />
            </div>
            <h3 className="mt-1.5 text-sm font-semibold leading-snug text-texto">
              {achado.titulo}
            </h3>
            <p className="mt-1 font-mono text-[11px] text-texto-2">
              {achado.cliente}
              {achado.cwe ? ` · ${achado.cwe}` : ""}
              {quando && (
                <>
                  {" · "}
                  <span
                    className={
                      !reteste && achado.status === "pendente"
                        ? "text-media"
                        : "text-texto-2"
                    }
                  >
                    {reteste ? `retestado ${quando}` : `reteste ${quando}`}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <AcoesExportacaoAchado achado={achado} onCopiar={onCopiar} />
          {reteste && (
            <Button
              variante="fantasma"
              tamanho="sm"
              onClick={() => onVerDelta(achado)}
            >
              delta
            </Button>
          )}
          <Button
            variante="primaria"
            tamanho="sm"
            onClick={() => onRegistrar(achado)}
          >
            {reteste ? "novo reteste" : "registrar reteste"}
          </Button>
        </div>
      </div>

      {reteste ? (
        <div className="border-t border-borda px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px]">
            <span className="text-texto-2">
              resultado:{" "}
              <span className="text-texto">
                {ROTULO_RESULTADO[reteste.resultado]}
              </span>
            </span>
            <span className="text-texto-2">
              data: <span className="text-texto">{dataCurta(reteste.data_reteste)}</span>
            </span>
            <span className="text-texto-2">
              histórico:{" "}
              <span className="text-texto">
                {achado.total_retestes} registro{achado.total_retestes === 1 ? "" : "s"}
              </span>
            </span>

            <button
              type="button"
              onClick={() =>
                onCopiar(
                  reteste.evidencia,
                  `Evidência de ${achado.achado_ref} copiada`,
                )
              }
              className="interativo ml-auto cursor-pointer rounded-sm border border-borda px-2 py-0.5 text-[10px] uppercase tracking-wider text-texto-2 hover:border-accent hover:text-accent"
            >
              copiar evidência
            </button>
          </div>

          {reteste.evidencia && (
            <pre className="mt-3 overflow-x-auto rounded-sm border border-borda bg-fundo p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-texto/80">
              {reteste.evidencia}
            </pre>
          )}
        </div>
      ) : (
        <p className="border-t border-borda px-5 py-3.5 text-sm text-texto-2">
          Aguardando reteste. Registre o resultado para confirmar ou refutar a
          correção.
        </p>
      )}
    </article>
  );
}

import { buscarUm, executar } from "@/lib/banco";
import { LIMITES, type Plano } from "@/lib/planos";

export { LIMITES, normalizarPlano } from "@/lib/planos";
export type { LimitesPlano, Plano } from "@/lib/planos";

/**
 * "2026-10" — chave do uso mensal (mês novo = linha nova = reset automático).
 * No fuso de Brasília: a cota vira à meia-noite do dia 1 para o usuário,
 * não às 21h do último dia (o que acontecia em UTC).
 */
export function mesAtual(data = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  })
    .format(data)
    .slice(0, 7);
}

export type UsoMensal = {
  relatorios_criados: number;
  retestes_registrados: number;
  geracoes_ia: number;
};

type CampoUso = keyof UsoMensal;

const VAZIO: UsoMensal = { relatorios_criados: 0, retestes_registrados: 0, geracoes_ia: 0 };

export async function obterUso(
  usuarioId: number,
  mes = mesAtual(),
): Promise<UsoMensal> {
  await executar(
    `INSERT INTO uso_mensal (usuario_id, mes_ano) VALUES (?, ?)
     ON CONFLICT (usuario_id, mes_ano) DO NOTHING`,
    usuarioId,
    mes,
  );
  return lerUso(usuarioId, mes);
}

/** Leitura sem escrita (não cria a linha): para checagens que não consomem. */
export async function lerUso(
  usuarioId: number,
  mes = mesAtual(),
): Promise<UsoMensal> {
  const linha = await buscarUm<UsoMensal>(
    "SELECT relatorios_criados, retestes_registrados, geracoes_ia FROM uso_mensal WHERE usuario_id = ? AND mes_ano = ?",
    usuarioId,
    mes,
  );
  return linha ? { ...VAZIO, ...linha } : { ...VAZIO };
}

export async function incrementarUso(
  usuarioId: number,
  campo: CampoUso,
  mes = mesAtual(),
): Promise<void> {
  await obterUso(usuarioId, mes); // garante a linha
  await executar(
    `UPDATE uso_mensal SET ${campo} = ${campo} + 1 WHERE usuario_id = ? AND mes_ano = ?`,
    usuarioId,
    mes,
  );
}

export type RecursoLimitado = "relatorios" | "retestes" | "geracoes";

const CAMPO: Record<RecursoLimitado, CampoUso> = {
  relatorios: "relatorios_criados",
  retestes: "retestes_registrados",
  geracoes: "geracoes_ia",
};

function limiteDe(plano: Plano, recurso: RecursoLimitado): number {
  const l = LIMITES[plano];
  if (recurso === "relatorios") return l.relatoriosMes;
  if (recurso === "retestes") return l.retestesMes;
  return l.geracoesIaMes;
}

export type VereditoLimite = {
  permitido: boolean;
  usados: number;
  limite: number;
  recurso: RecursoLimitado;
};

/** Verifica sem consumir (para avisos e checagens prévias). */
export function verificarLimite(
  plano: Plano,
  uso: UsoMensal,
  recurso: RecursoLimitado,
): VereditoLimite {
  const limite = limiteDe(plano, recurso);
  const usados = uso[CAMPO[recurso]];
  return { permitido: usados < limite, usados, limite, recurso };
}

/**
 * Consome 1 unidade de forma atômica: o UPDATE só passa se ainda houver
 * saldo, então duas requisições simultâneas não estouram o limite (o
 * "checa e depois incrementa" deixava passar). Negado = nada consumido.
 */
export async function consumirUso(
  usuarioId: number,
  plano: Plano,
  recurso: RecursoLimitado,
  mes = mesAtual(),
): Promise<VereditoLimite> {
  const campo = CAMPO[recurso];
  const limite = limiteDe(plano, recurso);
  await obterUso(usuarioId, mes); // garante a linha
  const alteradas = Number.isFinite(limite)
    ? await executar(
        `UPDATE uso_mensal SET ${campo} = ${campo} + 1
         WHERE usuario_id = ? AND mes_ano = ? AND ${campo} < ?`,
        usuarioId,
        mes,
        limite,
      )
    : await executar(
        `UPDATE uso_mensal SET ${campo} = ${campo} + 1 WHERE usuario_id = ? AND mes_ano = ?`,
        usuarioId,
        mes,
      );
  const usados = (await lerUso(usuarioId, mes))[campo];
  return { permitido: alteradas > 0, usados, limite, recurso };
}

/** Devolve 1 unidade consumida quando a ação falhou depois do consumo. */
export async function devolverUso(
  usuarioId: number,
  recurso: RecursoLimitado,
  mes = mesAtual(),
): Promise<void> {
  const campo = CAMPO[recurso];
  await executar(
    `UPDATE uso_mensal SET ${campo} = ${campo} - 1
     WHERE usuario_id = ? AND mes_ano = ? AND ${campo} > 0`,
    usuarioId,
    mes,
  );
}

const ROTULO: Record<RecursoLimitado, string> = {
  relatorios: "relatórios",
  retestes: "retestes",
  geracoes: "gerações com IA",
};

/** Resposta 402 padrão (o front abre o paywall com estes campos). */
export function respostaLimite(v: VereditoLimite, plano: Plano): Response {
  const proximo =
    plano === "free"
      ? "Faça upgrade para continuar."
      : plano === "pro"
        ? "Passe para o Team ou aguarde a virada do mês."
        : "A cota renova no dia 1.";
  return Response.json(
    {
      error: `Você usou ${v.usados}/${v.limite} ${ROTULO[v.recurso]} este mês. ${proximo}`,
      code: "LIMITE_PLANO",
      recurso: v.recurso,
      usados: v.usados,
      limite: v.limite,
      plano,
    },
    { status: 402 },
  );
}

/** Limpa linhas de meses passados (higiene; o reset é automático por mes_ano). */
export async function resetarUsoMensal(mes = mesAtual()): Promise<number> {
  return executar("DELETE FROM uso_mensal WHERE mes_ano <> ?", mes);
}

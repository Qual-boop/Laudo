import db from "@/lib/db";
import { exigirUsuario, erroApi } from "@/lib/api-auth";
import { incrementarUso, obterUso, verificarLimite } from "@/lib/limites";
import { normalizarConfianca, statusParaResultado } from "@/lib/verificacao";
import {
  esquemaAchadoIdQuery,
  esquemaPaginacao,
  esquemaReteste,
  validar,
} from "@/lib/validacao";
import type {
  AchadoVerificavel,
  Confianca,
  ResultadoReteste,
  Reteste,
  Severidade,
  StatusVerificacao,
} from "@/lib/tipos";

/* ============================================================
   Verificação de correções (multi-tenant: tudo filtra por
   usuario_id do JWT).

   Um reteste pode ser registrado quantas vezes quiser; o status do
   achado reflete sempre o ÚLTIMO. O histórico anterior fica em
   `retestes`, então nenhum dado se perde ao reexecutar.
   ============================================================ */

const RESULTADOS: ResultadoReteste[] = ["corrigido", "nao-corrigido", "parcial"];
const SEVERIDADES: Severidade[] = ["Critica", "Alta", "Media", "Baixa"];
const STATUS: StatusVerificacao[] = ["pendente", "verificado", "nao-corrigido"];
const CONFIANCAS: Confianca[] = ["Alta", "Media", "Baixa"];

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Lista achados do usuário com o último reteste de cada um.
 * 3 consultas fixas (lista + últimos + contagens) — sem N+1.
 */
function listarAchados(
  usuarioId: number,
  filtroAchadoId?: number,
  limit = 50,
  offset = 0,
): AchadoVerificavel[] {
  const condicoes = ["r.usuario_id = ?"];
  const args: unknown[] = [usuarioId];
  if (filtroAchadoId !== undefined) {
    condicoes.push("a.id = ?");
    args.push(filtroAchadoId);
  }

  const linhas = db
    .prepare(
      `SELECT a.*, r.cliente AS cliente, r.data AS data_relatorio
       FROM achados_verificacao a
       JOIN relatorios r ON r.id = a.relatorio_id
       WHERE ${condicoes.join(" AND ")}
       ORDER BY a.id DESC LIMIT ? OFFSET ?`,
    )
    .all(...args, limit, offset) as Record<string, unknown>[];

  if (linhas.length === 0) return [];

  const ids = linhas.map((l) => Number(l.id));
  const marcadores = ids.map(() => "?").join(",");

  // pegaN(1) retorna a linha mais recente de cada grupo por achado_id.
  const ultimos = db
    .prepare(
      `SELECT * FROM (
         SELECT * FROM retestes
          WHERE achado_id IN (${marcadores})
          ORDER BY achado_id, date(data_reteste) DESC, id DESC
       ) WHERE 1 GROUP BY achado_id`,
    )
    .all(...ids) as Record<string, unknown>[];

  const contagens = db
    .prepare(
      `SELECT achado_id, COUNT(*) AS total FROM retestes
       WHERE achado_id IN (${marcadores}) GROUP BY achado_id`,
    )
    .all(...ids) as { achado_id: number; total: number }[];

  const ultimoPorAchado = new Map(ultimos.map((u) => [Number(u.achado_id), u]));
  const totalPorAchado = new Map(contagens.map((c) => [c.achado_id, c.total]));

  return linhas.map((linha) => {
    const ultimo = ultimoPorAchado.get(Number(linha.id)) ?? null;

    return {
      id: Number(linha.id),
      relatorio_id: linha.relatorio_id === null ? null : Number(linha.relatorio_id),
      cliente: String(linha.cliente ?? "Não informado"),
      achado_ref: String(linha.achado_ref),
      titulo: String(linha.titulo),
      severidade: (SEVERIDADES.includes(linha.severidade as Severidade)
        ? linha.severidade
        : "Media") as Severidade,
      cwe: String(linha.cwe ?? ""),
      confianca: (CONFIANCAS.includes(linha.confianca as Confianca)
        ? linha.confianca
        : normalizarConfianca(linha.confianca)) as Confianca,
      data_reteste_sugerida: linha.data_reteste_sugerida
        ? String(linha.data_reteste_sugerida)
        : null,
      status: (STATUS.includes(linha.status as StatusVerificacao)
        ? linha.status
        : "pendente") as StatusVerificacao,
      criado_em: String(linha.criado_em ?? ""),
      ultimo_reteste: ultimo
        ? ({
            id: Number(ultimo.id),
            achado_id: Number(ultimo.achado_id),
            data_reteste: String(ultimo.data_reteste),
            resultado: (RESULTADOS.includes(ultimo.resultado as ResultadoReteste)
              ? ultimo.resultado
              : "nao-corrigido") as ResultadoReteste,
            evidencia: String(ultimo.evidencia ?? ""),
            criado_em: String(ultimo.criado_em ?? ""),
          } satisfies Reteste)
        : null,
      total_retestes: totalPorAchado.get(Number(linha.id)) ?? 0,
    };
  });
}

/** Dono do achado (via relatório) ou null se não existe. */
function donoDoAchado(achadoId: number): number | null {
  const linha = db
    .prepare(
      `SELECT r.usuario_id AS usuario_id
       FROM achados_verificacao a
       LEFT JOIN relatorios r ON r.id = a.relatorio_id
       WHERE a.id = ?`,
    )
    .get(achadoId) as { usuario_id: number | null } | undefined;
  return linha ? linha.usuario_id : null;
}

export async function GET(request: Request) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  const url = new URL(request.url);
  const qAchado = validar(esquemaAchadoIdQuery, url.searchParams.get("achadoId"));
  if (!qAchado.ok) return qAchado.resposta;

  const pag = validar(esquemaPaginacao, {
    limit: url.searchParams.get("limit"),
    page: url.searchParams.get("page"),
  });
  const { limit, page } = pag.ok ? pag.dados : { limit: 50, page: 1 };

  return Response.json(
    listarAchados(auth.usuario.id, qAchado.dados, limit, (page - 1) * limit),
  );
}

export async function POST(request: Request) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return erroApi("Corpo da requisição inválido.", "JSON_INVALIDO", 400);
  }

  const v = validar(esquemaReteste, corpo as Record<string, unknown>);
  if (!v.ok) return v.resposta;

  const { achadoId } = v.dados;
  const dono = donoDoAchado(achadoId);
  if (dono === null) {
    return erroApi("Achado não encontrado.", "NAO_ENCONTRADO", 404);
  }
  if (dono !== auth.usuario.id) {
    return erroApi("Acesso negado a este achado.", "ACESSO_NEGADO", 403);
  }

  // Plano free: no máximo 10 retestes por mês.
  const veredito = verificarLimite(
    auth.usuario.plano,
    obterUso(auth.usuario.id),
    "retestes",
  );
  if (!veredito.permitido) {
    return Response.json(
      {
        error: `Você usou ${veredito.usados}/${veredito.limite} retestes este mês. Faça upgrade para continuar.`,
        code: "LIMITE_PLANO",
        recurso: "retestes",
        usados: veredito.usados,
        limite: veredito.limite,
      },
      { status: 402 },
    );
  }

  const dataReteste =
    v.dados.dataReteste && /^\d{4}-\d{2}-\d{2}$/.test(v.dados.dataReteste)
      ? v.dados.dataReteste
      : hojeISO();
  const novoStatus = statusParaResultado(v.dados.resultado);

  // Reteste + atualização de status na mesma transação: nunca fica um
  // reteste gravado com o status antigo.
  const registrar = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO retestes (achado_id, data_reteste, resultado, evidencia)
         VALUES (?, ?, ?, ?)`,
      )
      .run(achadoId, dataReteste, v.dados.resultado, v.dados.evidencia);

    db.prepare("UPDATE achados_verificacao SET status = ? WHERE id = ?").run(
      novoStatus,
      achadoId,
    );

    return Number(info.lastInsertRowid);
  });

  const retesteId = registrar();
  incrementarUso(auth.usuario.id, "retestes_registrados");

  const [atualizado] = listarAchados(auth.usuario.id, achadoId);

  return Response.json(
    { retesteId, status: novoStatus, achado: atualizado },
    { status: 201 },
  );
}

/** DELETE /api/v1/verificacao?achadoId=… — volta o achado para pendente. */
export async function DELETE(request: Request) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  const bruto = new URL(request.url).searchParams.get("achadoId");
  if (bruto === null || bruto.trim() === "") {
    return erroApi("achadoId é obrigatório.", "ACHADOID_AUSENTE", 400);
  }

  const v = validar(esquemaAchadoIdQuery, bruto);
  if (!v.ok || v.dados === undefined) {
    return erroApi("achadoId inválido.", "ACHADOID_INVALIDO", 400);
  }
  const achadoId = v.dados;

  const dono = donoDoAchado(achadoId);
  if (dono === null) {
    return erroApi("Achado não encontrado.", "NAO_ENCONTRADO", 404);
  }
  if (dono !== auth.usuario.id) {
    return erroApi("Acesso negado a este achado.", "ACESSO_NEGADO", 403);
  }

  db.transaction(() => {
    db.prepare("DELETE FROM retestes WHERE achado_id = ?").run(achadoId);
    db.prepare("UPDATE achados_verificacao SET status = 'pendente' WHERE id = ?").run(
      achadoId,
    );
  })();

  return Response.json({ ok: true, achadoId });
}

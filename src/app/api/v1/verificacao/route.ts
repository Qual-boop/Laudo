import { buscarTodos, buscarUm, executar, inserir, transacao } from "@/lib/banco";
import { exigirUsuario, erroApi } from "@/lib/api-auth";
import { consumirUso, devolverUso, respostaLimite } from "@/lib/limites";
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
async function listarAchados(
  usuarioId: number,
  filtroAchadoId?: number,
  limit = 50,
  offset = 0,
): Promise<AchadoVerificavel[]> {
  const condicoes = ["r.usuario_id = ?"];
  const args: unknown[] = [usuarioId];
  if (filtroAchadoId !== undefined) {
    condicoes.push("a.id = ?");
    args.push(filtroAchadoId);
  }

  const linhas = await buscarTodos<Record<string, unknown>>(
    `SELECT a.*, r.cliente AS cliente, r.data AS data_relatorio
       FROM achados_verificacao a
       JOIN relatorios r ON r.id = a.relatorio_id
       WHERE ${condicoes.join(" AND ")}
       ORDER BY a.id DESC LIMIT ? OFFSET ?`,
    ...args,
    limit,
    offset,
  );

  if (linhas.length === 0) return [];

  const ids = linhas.map((l) => Number(l.id));
  const marcadores = ids.map(() => "?").join(",");

  // ROW_NUMBER() devolve a linha mais recente de cada achado_id — vale
  // igual em SQLite (3.25+) e Postgres.
  const ultimos = await buscarTodos<Record<string, unknown>>(
    `SELECT * FROM (
       SELECT *, ROW_NUMBER() OVER (
         PARTITION BY achado_id ORDER BY data_reteste DESC, id DESC
       ) AS rn
         FROM retestes
        WHERE achado_id IN (${marcadores})
     ) t WHERE rn = 1`,
    ...ids,
  );

  const contagens = await buscarTodos<{ achado_id: number; total: unknown }>(
    `SELECT achado_id, COUNT(*) AS total FROM retestes
     WHERE achado_id IN (${marcadores}) GROUP BY achado_id`,
    ...ids,
  );

  const ultimoPorAchado = new Map(ultimos.map((u) => [Number(u.achado_id), u]));
  const totalPorAchado = new Map(
    contagens.map((c) => [Number(c.achado_id), Number(c.total)]),
  );

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
async function donoDoAchado(achadoId: number): Promise<number | null> {
  const linha = await buscarUm<{ usuario_id: number | null }>(
    `SELECT r.usuario_id AS usuario_id
     FROM achados_verificacao a
     LEFT JOIN relatorios r ON r.id = a.relatorio_id
     WHERE a.id = ?`,
    achadoId,
  );
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
    await listarAchados(auth.usuario.id, qAchado.dados, limit, (page - 1) * limit),
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
  const dono = await donoDoAchado(achadoId);
  if (dono === null) {
    return erroApi("Achado não encontrado.", "NAO_ENCONTRADO", 404);
  }
  if (dono !== auth.usuario.id) {
    return erroApi("Acesso negado a este achado.", "ACESSO_NEGADO", 403);
  }

  // Plano free: no máximo 10 retestes por mês (consumo atômico).
  const veredito = await consumirUso(auth.usuario.id, auth.usuario.plano, "retestes");
  if (!veredito.permitido) return respostaLimite(veredito, auth.usuario.plano);

  const dataReteste =
    v.dados.dataReteste && /^\d{4}-\d{2}-\d{2}$/.test(v.dados.dataReteste)
      ? v.dados.dataReteste
      : hojeISO();
  const novoStatus = statusParaResultado(v.dados.resultado);

  // Reteste + atualização de status na mesma transação: nunca fica um
  // reteste gravado com o status antigo.
  const retesteId = await transacao(async () => {
    const id = await inserir(
      `INSERT INTO retestes (achado_id, data_reteste, resultado, evidencia)
       VALUES (?, ?, ?, ?)`,
      achadoId,
      dataReteste,
      v.dados.resultado,
      v.dados.evidencia,
    );

    await executar(
      "UPDATE achados_verificacao SET status = ? WHERE id = ?",
      novoStatus,
      achadoId,
    );

    return id;
  }).catch(async (e: unknown) => {
    await devolverUso(auth.usuario.id, "retestes");
    throw e;
  });

  const [atualizado] = await listarAchados(auth.usuario.id, achadoId);

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

  const dono = await donoDoAchado(achadoId);
  if (dono === null) {
    return erroApi("Achado não encontrado.", "NAO_ENCONTRADO", 404);
  }
  if (dono !== auth.usuario.id) {
    return erroApi("Acesso negado a este achado.", "ACESSO_NEGADO", 403);
  }

  await transacao(async () => {
    await executar("DELETE FROM retestes WHERE achado_id = ?", achadoId);
    await executar(
      "UPDATE achados_verificacao SET status = 'pendente' WHERE id = ?",
      achadoId,
    );
  });

  return Response.json({ ok: true, achadoId });
}

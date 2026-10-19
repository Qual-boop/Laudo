import { buscarTodos, dialeto, executar, inserir, transacao } from "@/lib/banco";
import { exigirUsuario, erroApi } from "@/lib/api-auth";
import {
  consumirUso,
  devolverUso,
  LIMITES,
  respostaLimite,
} from "@/lib/limites";
import { normalizarConfianca } from "@/lib/verificacao";
import {
  esquemaPaginacao,
  esquemaSalvarRelatorio,
  validar,
} from "@/lib/validacao";

/** POST /api/v1/relatorios — salva relatório + achados (transação). */
export async function POST(request: Request) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return erroApi("Corpo da requisição inválido.", "JSON_INVALIDO", 400);
  }

  const v = validar(esquemaSalvarRelatorio, corpo);
  if (!v.ok) return v.resposta;

  const { capa, achados } = v.dados;
  const limites = LIMITES[auth.usuario.plano];

  // Plano free: no máximo 5 achados por relatório.
  if (achados.length > limites.achadosPorRelatorio) {
    return Response.json(
      {
        error: `Seu plano ${auth.usuario.plano} permite até ${limites.achadosPorRelatorio} achados por relatório. No Pro e no Team não há limite de achados.`,
        code: "LIMITE_PLANO",
        recurso: "achados",
        usados: achados.length,
        limite: limites.achadosPorRelatorio,
      },
      { status: 402 },
    );
  }

  // Cota mensal de relatórios (Free 3, Pro 300, Team 900), consumida de
  // forma atômica: dois salvamentos simultâneos não passam do limite.
  const veredito = await consumirUso(auth.usuario.id, auth.usuario.plano, "relatorios");
  if (!veredito.permitido) return respostaLimite(veredito, auth.usuario.plano);
  const riscoGeral = v.dados.sumarioExecutivo?.riscoGeral || "Medio";

  // Relatório e achados entram juntos: um relatório salvo sem achados
  // verificáveis deixaria a aba Verificação inconsistente. Se a gravação
  // falhar, a unidade consumida volta.
  const relatorioId = await transacao(async () => {
    const id = await inserir(
      `INSERT INTO relatorios (cliente, titulo, data, versao, risco_geral, total_achados, relatorio_json, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      capa.cliente || "Não informado",
      capa.titulo || "Relatório",
      capa.data || new Date().toISOString().slice(0, 10),
      capa.versao || "1.0",
      riscoGeral,
      achados.length,
      JSON.stringify(corpo),
      auth.usuario.id,
    );

    for (const [i, achado] of achados.entries()) {
      await executar(
        `INSERT INTO achados_verificacao
           (relatorio_id, achado_ref, titulo, severidade, cwe, confianca, data_reteste_sugerida, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente')`,
        id,
        achado.id || `FINDING-${String(i + 1).padStart(3, "0")}`,
        achado.titulo || "Achado sem título",
        achado.severidade || "Media",
        achado.cwe || null,
        normalizarConfianca(achado.confianca),
        achado.dataRetesteSugerida || null,
      );
    }

    return id;
  }).catch(async (e: unknown) => {
    await devolverUso(auth.usuario.id, "relatorios");
    throw e;
  });

  return Response.json(
    { id: relatorioId, achados: achados.length },
    { status: 201 },
  );
}

/** GET /api/v1/relatorios — lista SÓ os relatórios do usuário (?limit=&page=). */
export async function GET(request: Request) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  const url = new URL(request.url);
  const pag = validar(esquemaPaginacao, {
    limit: url.searchParams.get("limit"),
    page: url.searchParams.get("page"),
  });
  // searchParams.get devolve null quando ausente — o esquema trata.
  const { limit, page } = pag.ok
    ? pag.dados
    : { limit: 50, page: 1 };

  // Plano free: histórico limitado aos últimos 30 dias.
  // (data de corte calculada em SQL de cada dialeto)
  const filtroDias =
    LIMITES[auth.usuario.plano].historicoDias === Infinity
      ? ""
      : dialeto() === "pg"
        ? "AND r.criado_em >= now() - interval '30 days'"
        : "AND r.criado_em >= datetime('now', '-30 days')";

  const relatorios = await buscarTodos<Record<string, unknown>>(
    `SELECT r.id, r.cliente, r.titulo, r.data, r.versao, r.risco_geral, r.total_achados, r.criado_em,
            (SELECT COUNT(*) FROM achados_verificacao a
              WHERE a.relatorio_id = r.id AND a.status = 'verificado') AS achados_verificados
     FROM relatorios r WHERE r.usuario_id = ? ${filtroDias} ORDER BY r.id DESC LIMIT ? OFFSET ?`,
    auth.usuario.id,
    limit,
    (page - 1) * limit,
  );

  // COUNT(*) no Postgres volta como texto (int8) — normaliza para número.
  return Response.json(
    relatorios.map((r) => ({
      ...r,
      achados_verificados: Number(r.achados_verificados ?? 0),
    })),
  );
}

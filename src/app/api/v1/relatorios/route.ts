import db from "@/lib/db";
import { exigirUsuario, erroApi } from "@/lib/api-auth";
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
  const riscoGeral = v.dados.sumarioExecutivo?.riscoGeral || "Medio";

  const inserirRelatorio = db.prepare(
    `INSERT INTO relatorios (cliente, titulo, data, versao, risco_geral, total_achados, relatorio_json, usuario_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const inserirAchado = db.prepare(
    `INSERT INTO achados_verificacao
       (relatorio_id, achado_ref, titulo, severidade, cwe, confianca, data_reteste_sugerida, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente')`,
  );

  // Relatório e achados entram juntos: um relatório salvo sem achados
  // verificáveis deixaria a aba Verificação inconsistente.
  const salvar = db.transaction(() => {
    const info = inserirRelatorio.run(
      capa.cliente || "Não informado",
      capa.titulo || "Relatório",
      capa.data || new Date().toISOString().slice(0, 10),
      capa.versao || "1.0",
      riscoGeral,
      achados.length,
      JSON.stringify(corpo),
      auth.usuario.id,
    );

    const relatorioId = Number(info.lastInsertRowid);

    for (const [i, achado] of achados.entries()) {
      inserirAchado.run(
        relatorioId,
        achado.id || `FINDING-${String(i + 1).padStart(3, "0")}`,
        achado.titulo || "Achado sem título",
        achado.severidade || "Media",
        achado.cwe || null,
        normalizarConfianca(achado.confianca),
        achado.dataRetesteSugerida || null,
      );
    }

    return relatorioId;
  });

  const relatorioId = salvar();

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

  const relatorios = db
    .prepare(
      `SELECT r.id, r.cliente, r.titulo, r.data, r.versao, r.risco_geral, r.total_achados, r.criado_em,
              (SELECT COUNT(*) FROM achados_verificacao a
                WHERE a.relatorio_id = r.id AND a.status = 'verificado') AS achados_verificados
       FROM relatorios r WHERE r.usuario_id = ? ORDER BY r.id DESC LIMIT ? OFFSET ?`,
    )
    .all(auth.usuario.id, limit, (page - 1) * limit);

  return Response.json(relatorios);
}

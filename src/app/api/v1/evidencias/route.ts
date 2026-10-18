import { papelNoAchado } from "@/lib/acesso";
import { exigirUsuario, erroApi } from "@/lib/api-auth";
import { buscarTodos, buscarUm, inserir } from "@/lib/banco";
import {
  MAX_BYTES_EVIDENCIA,
  MAX_LEGENDA,
  MENSAGEM_PROBLEMA,
  validarEvidencia,
  type EvidenciaResumo,
} from "@/lib/evidencias";

function idValido(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** GET /api/v1/evidencias?achadoId=ID — lista (sem os bytes). Dono ou revisor. */
export async function GET(request: Request) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;
  const achadoId = idValido(new URL(request.url).searchParams.get("achadoId"));
  if (!achadoId) return erroApi("Informe o achado.", "VALIDACAO", 400);
  if (!(await papelNoAchado(auth.usuario.id, achadoId))) {
    return erroApi("Achado não encontrado.", "NAO_ENCONTRADO", 404);
  }
  const linhas = await buscarTodos<EvidenciaResumo>(
    `SELECT e.id, COALESCE(e.legenda, '') AS legenda, e.mime, e.tamanho, e.criado_em, u.nome AS autor
       FROM evidencias e JOIN usuarios u ON u.id = e.usuario_id
      WHERE e.achado_id = ? ORDER BY e.id`,
    achadoId,
  );
  return Response.json(
    linhas.map((l) => ({ ...l, id: Number(l.id), tamanho: Number(l.tamanho), criado_em: String(l.criado_em) })),
  );
}

/** POST /api/v1/evidencias — multipart: achadoId, legenda, arquivo. Só o dono. */
export async function POST(request: Request) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES_EVIDENCIA + 64 * 1024) {
    return erroApi(MENSAGEM_PROBLEMA.grande, "ARQUIVO_GRANDE", 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return erroApi("Envie o print como multipart/form-data.", "CORPO_INVALIDO", 400);
  }
  const achadoId = idValido(form.get("achadoId"));
  const arquivo = form.get("arquivo");
  if (!achadoId || !(arquivo instanceof Blob)) return erroApi("Informe o achado e o arquivo.", "VALIDACAO", 400);

  const acesso = await papelNoAchado(auth.usuario.id, achadoId);
  if (!acesso) return erroApi("Achado não encontrado.", "NAO_ENCONTRADO", 404);
  if (acesso.papel !== "dono") return erroApi("Só o dono do relatório adiciona evidências.", "ACESSO_NEGADO", 403);

  const existentes = await buscarUm<{ n: number }>(
    "SELECT COUNT(*) AS n FROM evidencias WHERE achado_id = ?",
    achadoId,
  );
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const v = validarEvidencia(bytes, Number(existentes?.n ?? 0));
  if (!v.ok) {
    return erroApi(MENSAGEM_PROBLEMA[v.problema], `EVIDENCIA_${v.problema.toUpperCase()}`, v.problema === "grande" ? 413 : 400);
  }

  const legenda = String(form.get("legenda") ?? "").trim().slice(0, MAX_LEGENDA);
  const id = await inserir(
    "INSERT INTO evidencias (achado_id, usuario_id, legenda, mime, tamanho, dados) VALUES (?, ?, ?, ?, ?, ?)",
    achadoId,
    auth.usuario.id,
    legenda || null,
    v.mime,
    bytes.length,
    Buffer.from(bytes).toString("base64"),
  );
  return Response.json({ id, legenda, mime: v.mime, tamanho: bytes.length }, { status: 201 });
}

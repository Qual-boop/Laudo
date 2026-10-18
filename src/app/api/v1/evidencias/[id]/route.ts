import { papelNoAchado } from "@/lib/acesso";
import { exigirUsuario, erroApi } from "@/lib/api-auth";
import { buscarUm, executar } from "@/lib/banco";
import { tipoDaImagem } from "@/lib/evidencias";

type Ctx = { params: Promise<{ id: string }> };

async function carregar(request: Request, ctx: Ctx) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return { resposta: auth.resposta } as const;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return { resposta: erroApi("Evidência inválida.", "VALIDACAO", 400) } as const;
  const linha = await buscarUm<{ achado_id: number; dados: string }>(
    "SELECT achado_id, dados FROM evidencias WHERE id = ?",
    id,
  );
  const acesso = linha ? await papelNoAchado(auth.usuario.id, Number(linha.achado_id)) : null;
  // 404 também sem acesso: não revela que a evidência existe.
  if (!linha || !acesso) return { resposta: erroApi("Evidência não encontrada.", "NAO_ENCONTRADO", 404) } as const;
  return { id, linha, papel: acesso.papel } as const;
}

/** GET /api/v1/evidencias/[id] — a imagem. Dono ou revisor. */
export async function GET(request: Request, ctx: Ctx) {
  const r = await carregar(request, ctx);
  if ("resposta" in r) return r.resposta;
  const bytes = Buffer.from(r.linha.dados, "base64");
  // Tipo de novo pelos bytes: o que está no banco não é confiado às cegas.
  const mime = tipoDaImagem(bytes);
  if (!mime) return erroApi("Evidência corrompida.", "DADO_CORROMPIDO", 500);
  return new Response(bytes, {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `inline; filename="evidencia-${r.id}.${mime.split("/")[1]}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
      "Cache-Control": "private, max-age=300",
    },
  });
}

/** DELETE /api/v1/evidencias/[id] — só o dono do relatório. */
export async function DELETE(request: Request, ctx: Ctx) {
  const r = await carregar(request, ctx);
  if ("resposta" in r) return r.resposta;
  if (r.papel !== "dono") return erroApi("Só o dono do relatório remove evidências.", "ACESSO_NEGADO", 403);
  await executar("DELETE FROM evidencias WHERE id = ?", r.id);
  return new Response(null, { status: 204 });
}

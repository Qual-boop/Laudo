import { exigirUsuario } from "@/lib/api-auth";
import { buscarTodos } from "@/lib/banco";
import type { RelatorioCompartilhado } from "@/lib/equipe";

/** GET /api/v1/compartilhados — relatórios que colegas compartilharam comigo. */
export async function GET(request: Request) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;
  const linhas = await buscarTodos<RelatorioCompartilhado>(
    `SELECT r.id, r.cliente, r.titulo, r.data, r.total_achados, u.nome AS dono
       FROM compartilhamentos c
       JOIN relatorios r ON r.id = c.relatorio_id
       JOIN usuarios u ON u.id = r.usuario_id
      WHERE c.usuario_id = ?
      ORDER BY r.id DESC`,
    auth.usuario.id,
  );
  return Response.json(linhas.map((l) => ({ ...l, id: Number(l.id), total_achados: Number(l.total_achados) })));
}

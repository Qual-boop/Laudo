import { exigirUsuario, erroApi } from "@/lib/api-auth";
import { eventosDaAgenda, gerarIcs } from "@/lib/agenda";
import { normalizarPlano } from "@/lib/planos";
import type { AchadoVerificavel } from "@/lib/tipos";
import { GET as listarVerificacao } from "@/app/api/v1/verificacao/route";

/**
 * GET /api/v1/agenda — calendário (.ics) com retestes e prazos dos achados
 * em aberto. ?relatorio=ID restringe a um relatório. Pro e Team.
 * A lista vem do próprio handler de verificação (mesma regra de acesso).
 */
export async function GET(request: Request) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;
  if (normalizarPlano(auth.usuario.plano) === "free") {
    return erroApi("A agenda de retestes é dos planos Pro e Team.", "PLANO_INSUFICIENTE", 402);
  }

  const url = new URL(request.url);
  const filtro = Number(url.searchParams.get("relatorio"));
  const urlLista = new URL("/api/v1/verificacao?limit=200", url);
  const res = await listarVerificacao(new Request(urlLista, { headers: request.headers }));
  if (!res.ok) return erroApi("Não foi possível montar a agenda.", "AGENDA_INDISPONIVEL", 500);
  const todos = (await res.json()) as AchadoVerificavel[];
  const achados = Number.isInteger(filtro) && filtro > 0 ? todos.filter((a) => a.relatorio_id === filtro) : todos;

  return new Response(gerarIcs(eventosDaAgenda(achados)), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="laudo-retestes${filtro > 0 ? `-${filtro}` : ""}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}

import { z } from "zod";
import { exigirUsuario, erroApi } from "@/lib/api-auth";
import { EscudoPrivacidade } from "@/lib/anonimizacao";
import { buscarUm } from "@/lib/banco";
import { completarJson } from "@/lib/ia";
import {
  ehStack,
  kitLocal,
  montarPromptKit,
  normalizarKit,
  type AchadoParaKit,
} from "@/lib/kit-correcao";
import { consumir, resposta429 } from "@/lib/limite-taxa";
import type { Severidade } from "@/lib/tipos";

/** Cada kit é uma chamada de IA: teto por usuário para conter custo e abuso. */
const REGRA_KIT = { limite: 20, janelaMs: 60 * 60_000 };

const esquema = z.object({
  achadoId: z.coerce.number().int().positive(),
  stack: z.string().refine(ehStack, "Stack não suportada."),
});

type Linha = {
  achado_ref: string;
  titulo: string;
  severidade: string;
  cwe: string | null;
  cliente: string;
  relatorio_json: unknown;
};

function objeto(v: unknown): Record<string, unknown> {
  if (typeof v === "string") {
    try {
      return objeto(JSON.parse(v));
    } catch {
      return {};
    }
  }
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function texto(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Junta o achado da verificação com o texto completo salvo no relatório. */
function montarAchado(linha: Linha): AchadoParaKit {
  const relatorio = objeto(linha.relatorio_json);
  const achados = Array.isArray(relatorio.achados) ? relatorio.achados.map(objeto) : [];
  const doRelatorio =
    achados.find((a) => texto(a.id) === linha.achado_ref) ??
    achados.find((a) => texto(a.titulo) === linha.titulo) ??
    {};
  const remediacao = objeto(doRelatorio.remediacao);
  return {
    ref: linha.achado_ref,
    titulo: linha.titulo,
    severidade: (["Critica", "Alta", "Media", "Baixa"].includes(linha.severidade)
      ? linha.severidade
      : "Media") as Severidade,
    cwe: linha.cwe ?? texto(doRelatorio.cwe),
    descricao: texto(doRelatorio.descricaoTecnica),
    evidencia: texto(doRelatorio.evidencias),
    passos: Array.isArray(doRelatorio.passosReproducao)
      ? doRelatorio.passosReproducao.filter((p): p is string => typeof p === "string")
      : [],
    remediacao: [texto(remediacao.curtoPrazo), texto(remediacao.longoPrazo)].filter(Boolean).join(" "),
  };
}

/**
 * POST /api/v1/kit-correcao — { achadoId, stack } → kit de correção para devs.
 * Só o dono do relatório; dados do cliente passam pelo escudo antes da IA.
 */
export async function POST(request: Request) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return erroApi("Corpo da requisição inválido.", "JSON_INVALIDO", 400);
  }
  const v = esquema.safeParse(corpo);
  if (!v.success) return erroApi("Informe o achado e uma stack suportada.", "VALIDACAO", 400);

  const linha = await buscarUm<Linha & { usuario_id: number | null }>(
    `SELECT a.achado_ref, a.titulo, a.severidade, a.cwe, r.cliente, r.relatorio_json, r.usuario_id
       FROM achados_verificacao a
       JOIN relatorios r ON r.id = a.relatorio_id
      WHERE a.id = ?`,
    v.data.achadoId,
  );
  // 404 também para achado de outro usuário: não revela que existe.
  if (!linha || Number(linha.usuario_id) !== auth.usuario.id) {
    return erroApi("Achado não encontrado.", "NAO_ENCONTRADO", 404);
  }

  const bloqueio = consumir(`kit:${auth.usuario.id}`, REGRA_KIT);
  if (bloqueio) return resposta429(bloqueio);

  const stack = v.data.stack as Parameters<typeof kitLocal>[1];
  const achado = montarAchado(linha);
  const escudo = new EscudoPrivacidade([linha.cliente]);
  const protegido = escudo.anonimizar(achado);

  const resposta = await completarJson(montarPromptKit(protegido, stack));
  const kit = resposta ? normalizarKit(resposta.dados, protegido, stack) : kitLocal(protegido, stack);

  return Response.json(escudo.restaurar(kit), {
    headers: { "X-Laudo-Protegidos": escudo.cabecalho() },
  });
}

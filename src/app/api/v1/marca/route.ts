import { exigirUsuario, erroApi } from "@/lib/api-auth";
import { LIMITES } from "@/lib/planos";
import { esquemaMarca, lerMarca, logoValido, salvarMarca } from "@/lib/marca";
import { validar } from "@/lib/validacao";

/** GET /api/v1/marca — marca do PDF do usuário (+ se o plano permite). */
export async function GET(request: Request) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;
  return Response.json({
    permitido: LIMITES[auth.usuario.plano].marcaPropria,
    marca: await lerMarca(auth.usuario.id),
  });
}

/**
 * PUT /api/v1/marca — grava nome, cor, logo, responsável e contato.
 * Campo ausente mantém o valor; `null` apaga. Só Pro/Team.
 */
export async function PUT(request: Request) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  if (!LIMITES[auth.usuario.plano].marcaPropria) {
    return Response.json(
      {
        error: "A marca própria no PDF está nos planos Pro e Team.",
        code: "LIMITE_PLANO",
        recurso: "marca",
        usados: 0,
        limite: 0,
        plano: auth.usuario.plano,
      },
      { status: 402 },
    );
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return erroApi("Corpo da requisição inválido.", "JSON_INVALIDO", 400);
  }
  const v = validar(esquemaMarca, corpo);
  if (!v.ok) return v.resposta;

  const atual = await lerMarca(auth.usuario.id);
  const novo = { ...atual };
  for (const campo of ["nome", "cor", "responsavel", "contato"] as const) {
    if (v.dados[campo] !== undefined) novo[campo] = v.dados[campo] ?? null;
  }
  if (v.dados.logo !== undefined) {
    if (v.dados.logo === null) {
      novo.logo = null;
    } else {
      const ok = logoValido(v.dados.logo);
      if (!ok) {
        return erroApi(
          "Logo inválido: use PNG, JPEG ou WebP de até 200 KB.",
          "LOGO_INVALIDO",
          400,
        );
      }
      novo.logo = ok;
    }
  }

  await salvarMarca(auth.usuario.id, novo);
  return Response.json({ ok: true, marca: novo });
}

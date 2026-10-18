import { payloadCanonico } from "@/lib/certificado";
import { certificadoPorToken } from "@/lib/certificado-publico";

/**
 * GET /c/[token]/json — o texto exato que entra no hash do certificado.
 * `curl -s <url> | sha256sum` devolve o mesmo hash mostrado na página.
 * Mesmas regras do link público: 404 se o link não vale mais.
 */

const CABECALHOS_PRIVADOS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const certificado = await certificadoPorToken(token);

  if (!certificado) {
    return Response.json(
      { error: "Certificado não encontrado.", code: "NAO_ENCONTRADO" },
      { status: 404, headers: CABECALHOS_PRIVADOS },
    );
  }

  return new Response(payloadCanonico(certificado.dados), {
    headers: {
      ...CABECALHOS_PRIVADOS,
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="certificado-${certificado.dados.relatorio.id}.json"`,
    },
  });
}

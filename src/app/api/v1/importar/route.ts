import { exigirUsuario, erroApi } from "@/lib/api-auth";
import { ErroImportacao, importarScanner } from "@/lib/importacao";

/** Arquivos .nessus de redes grandes passam fácil de alguns MB. */
const LIMITE_BYTES = 15 * 1024 * 1024;

/**
 * POST /api/v1/importar — corpo: o arquivo do scanner como texto.
 * Devolve achados no formato do formulário; nada é salvo aqui.
 */
export async function POST(request: Request) {
  const auth = await exigirUsuario(request);
  if (!auth.ok) return auth.resposta;

  const declarado = Number(request.headers.get("content-length") ?? 0);
  if (declarado > LIMITE_BYTES) {
    return erroApi("Arquivo maior que 15 MB. Exporte só o escopo do engagement.", "ARQUIVO_GRANDE", 413);
  }

  let conteudo: string;
  try {
    conteudo = await request.text();
  } catch {
    return erroApi("Não foi possível ler o arquivo enviado.", "CORPO_INVALIDO", 400);
  }
  if (Buffer.byteLength(conteudo) > LIMITE_BYTES) {
    return erroApi("Arquivo maior que 15 MB. Exporte só o escopo do engagement.", "ARQUIVO_GRANDE", 413);
  }
  if (!conteudo.trim()) {
    return erroApi("O arquivo está vazio.", "ARQUIVO_VAZIO", 400);
  }

  try {
    return Response.json(importarScanner(conteudo));
  } catch (e) {
    if (e instanceof ErroImportacao) return erroApi(e.message, "FORMATO_NAO_SUPORTADO", 422);
    throw e;
  }
}

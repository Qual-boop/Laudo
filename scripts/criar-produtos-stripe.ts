/**
 * Cria os 4 produtos/preços do Laudo no Stripe (modo TESTE).
 *
 *   npm run stripe:setup
 *
 * Idempotente: procura produto ativo por nome e reaproveita o preço com
 * mesmo valor/intervalo/moeda; só cria o que falta. Imprime os Price IDs
 * para colar no .env (FASE 3).
 *
 * Roda com o Node 22+ direto (type stripping nativo) — sem tsx.
 */
import Stripe from "stripe";
import fs from "node:fs";
import path from "node:path";

function lerEnv(caminho: string, chave: string): string {
  const linha = fs
    .readFileSync(caminho, "utf8")
    .split("\n")
    .find((l) => l.startsWith(`${chave}=`));
  if (!linha) return "";
  return linha
    .slice(chave.length + 1)
    .replace(/^"|"$/g, "")
    .trim();
}

type Alvo = {
  env: string;
  produto: string;
  intervalo: "month" | "year";
  valor: number; // centavos BRL
};

const ALVOS: Alvo[] = [
  { env: "STRIPE_PRICE_PRO_MENSAL", produto: "Laudo Pro", intervalo: "month", valor: 1990 },
  { env: "STRIPE_PRICE_PRO_ANUAL", produto: "Laudo Pro", intervalo: "year", valor: 19104 },
  { env: "STRIPE_PRICE_TEAM_MENSAL", produto: "Laudo Team", intervalo: "month", valor: 4990 },
  { env: "STRIPE_PRICE_TEAM_ANUAL", produto: "Laudo Team", intervalo: "year", valor: 47904 },
];

async function precoExistente(
  stripe: Stripe,
  produtoId: string,
  alvo: Alvo,
): Promise<string | null> {
  const precos = await stripe.prices.list({ product: produtoId, active: true, limit: 20 });
  const achado = precos.data.find(
    (p) =>
      p.unit_amount === alvo.valor &&
      p.currency === "brl" &&
      p.recurring?.interval === alvo.intervalo,
  );
  return achado ? achado.id : null;
}

async function main(): Promise<void> {
  const raiz = process.cwd();
  const segredo = lerEnv(path.join(raiz, ".env"), "STRIPE_SECRET_KEY");
  if (!segredo) {
    console.error("STRIPE_SECRET_KEY ausente no .env");
    process.exit(1);
  }
  if (!segredo.startsWith("sk_test_")) {
    console.error("Recuso rodar fora do modo TESTE (esperado sk_test_)");
    process.exit(1);
  }

  const stripe = new Stripe(segredo, { maxNetworkRetries: 2, timeout: 30000 });
  const conta = await stripe.accounts.retrieveCurrent();
  console.log(`Conta Stripe: ${conta.id} (${conta.country}) — MODO TESTE`);

  // Uma busca por produto + fallback para list (fortemente consistente):
  // o índice de search tem lag de minutos e não veria um produto criado
  // agora há pouco (foi assim que nasceram duplicatas). Preços usam
  // prices.list — também fortemente consistente, sem lag.
  const produtoPorNome = new Map<string, string>();
  const todos = await stripe.products.list({ limit: 100, active: true });
  for (const nome of [...new Set(ALVOS.map((a) => a.produto))]) {
    const viaLista = todos.data.find((p) => p.name === nome);
    if (viaLista) {
      produtoPorNome.set(nome, viaLista.id);
      continue;
    }
    const busca = await stripe.products.search({
      query: `name:"${nome}" AND active:"true"`,
      limit: 5,
    });
    if (busca.data[0]) {
      produtoPorNome.set(nome, busca.data[0].id);
    }
  }

  const saidas: string[] = [];
  for (const alvo of ALVOS) {
    let produtoId = produtoPorNome.get(alvo.produto);
    if (!produtoId) {
      const produto = await stripe.products.create({
        name: alvo.produto,
        description:
          alvo.produto === "Laudo Pro"
            ? "Relatórios ilimitados, exportação Jira/GitHub e certificado de correção."
            : "Tudo do Pro para até 10 usuários: compartilhamento, revisão e dashboard.",
      });
      console.log(`Produto criado ${alvo.produto}: ${produto.id}`);
      produtoId = produto.id;
      produtoPorNome.set(alvo.produto, produtoId);
    }

    const reaproveitado = await precoExistente(stripe, produtoId, alvo);
    if (reaproveitado) {
      console.log(`Reaproveitado ${alvo.produto} ${alvo.intervalo}: ${reaproveitado}`);
      saidas.push(`${alvo.env}=${reaproveitado}`);
      continue;
    }

    const preco = await stripe.prices.create({
      product: produtoId,
      unit_amount: alvo.valor,
      currency: "brl",
      recurring: { interval: alvo.intervalo },
      nickname: `${alvo.produto} ${alvo.intervalo === "month" ? "mensal" : "anual"}`,
    });
    console.log(`Preço criado ${alvo.produto} ${alvo.intervalo}: ${preco.id}`);
    saidas.push(`${alvo.env}=${preco.id}`);
  }

  console.log("\n---- Cole no .env ----");
  for (const linha of saidas) console.log(linha);
}

main().catch((e) => {
  console.error("FALHA:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});

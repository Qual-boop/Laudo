/**
 * Limpa TODOS os dados do banco local (pentest.db).
 *
 *   node scripts/limpar-banco.ts            # dry-run: mostra contagens, não apaga
 *   node scripts/limpar-banco.ts --executar # apaga de verdade + VACUUM
 *
 * Apaga retestes → achados_verificacao → relatorios → achados (tabela
 * legada órfã) e remove a tabela legada. Uso: ambiente de dev/teste.
 * NUNCA rode em produção.
 */
import Database from "better-sqlite3";
import path from "node:path";

const TABELAS = ["retestes", "achados_verificacao", "relatorios", "achados"];

function contagens(db: Database.Database): Record<string, number> {
  const saidas: Record<string, number> = {};
  for (const t of TABELAS) {
    try {
      const linha = db
        .prepare(`SELECT COUNT(*) AS n FROM ${t}`)
        .get() as { n: number };
      saidas[t] = Number(linha.n);
    } catch {
      saidas[t] = -1; // tabela não existe
    }
  }
  return saidas;
}

function main(): void {
  const executar = process.argv.includes("--executar");
  const caminho = path.join(process.cwd(), "pentest.db");
  const db = new Database(caminho);

  const antes = contagens(db);
  console.log("Contagens atuais:", JSON.stringify(antes));

  if (!executar) {
    console.log("Dry-run. Passe --executar para apagar de verdade.");
    db.close();
    return;
  }

  db.exec("DELETE FROM retestes;");
  db.exec("DELETE FROM achados_verificacao;");
  db.exec("DELETE FROM relatorios;");
  db.exec("DELETE FROM achados;");
  db.exec("DROP TABLE IF EXISTS achados;");
  db.exec("VACUUM;");

  const depois = contagens(db);
  console.log("Contagens após limpeza:", JSON.stringify(depois));
  console.log("Banco limpo. Tabela legada 'achados' removida.");
  db.close();
}

main();

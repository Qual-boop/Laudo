import Database from "better-sqlite3";
import path from "path";

const db = new Database(path.join(process.cwd(), "pentest.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS relatorios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente TEXT NOT NULL,
    titulo TEXT NOT NULL,
    data TEXT NOT NULL,
    versao TEXT NOT NULL,
    risco_geral TEXT NOT NULL,
    total_achados INTEGER NOT NULL,
    relatorio_json TEXT NOT NULL,
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

/* ------------------------------------------------------------
   Verificação de correções.

   Achado vira uma linha verificável quando o relatório é salvo.
   O status reflete o ÚLTIMO reteste — o histórico completo fica em
   `retestes`, então reexecutar o reteste não apaga o anterior.

   Status ∈ pendente | verificado | nao-corrigido
   Um reteste "parcial" NÃO marca como verificado.
   ------------------------------------------------------------ */

db.exec(`
  CREATE TABLE IF NOT EXISTS achados_verificacao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    relatorio_id INTEGER REFERENCES relatorios(id) ON DELETE CASCADE,
    achado_ref TEXT NOT NULL,
    titulo TEXT NOT NULL,
    severidade TEXT NOT NULL,
    cwe TEXT,
    confianca TEXT NOT NULL DEFAULT 'Media',
    data_reteste_sugerida TEXT,
    status TEXT NOT NULL DEFAULT 'pendente',
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS retestes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    achado_id INTEGER NOT NULL REFERENCES achados_verificacao(id) ON DELETE CASCADE,
    data_reteste TEXT NOT NULL,
    resultado TEXT NOT NULL,
    evidencia TEXT,
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Índices das consultas mais frequentes da aba Verificação.
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_achados_status ON achados_verificacao(status);
  CREATE INDEX IF NOT EXISTS idx_achados_relatorio ON achados_verificacao(relatorio_id);
  CREATE INDEX IF NOT EXISTS idx_retestes_achado ON retestes(achado_id, data_reteste DESC);
`);

export default db;

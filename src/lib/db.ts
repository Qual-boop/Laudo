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

export default db;

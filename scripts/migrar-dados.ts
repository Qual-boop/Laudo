/**
 * Migração de dados SQLite (pentest.db) → PostgreSQL (Neon).
 *
 *   node scripts/migrar-dados.ts            # dry-run: mostra contagens, não escreve
 *   node scripts/migrar-dados.ts --executar # cria schema + copia tudo + confere
 *
 * Requisitos:
 *   DATABASE_URL=postgresql://... no .env (painel do Neon → Connection string)
 *
 * Ordem de cópia (respeita FKs): usuarios → uso_mensal → sessoes →
 * relatorios → achados_verificacao → retestes → webhook_eventos.
 *
 * Conversões de tipo:
 *   - id INTEGER (SQLite) → SERIAL (PG): preserva o valor original com
 *     setval() ao final, para não quebrar referências entre tabelas.
 *   - datas TEXT ISO ("2026-01-01T00:00:00.000Z" ou CURRENT_TIMESTAMP
 *     "YYYY-MM-DD HH:MM:SS") → TIMESTAMPTZ. Nulo continua nulo.
 *
 * Idempotência: usa ON CONFLICT DO NOTHING pela PK — rodar 2x não duplica.
 * NUNCA apaga nada no destino.
 *
 * Auto-contido (sem imports relativos), como scripts/limpar-banco.ts.
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const TABELAS = [
  "usuarios",
  "uso_mensal",
  "sessoes",
  "relatorios",
  "achados_verificacao",
  "retestes",
  "webhook_eventos",
] as const;

// Colunas TIMESTAMPTZ no Postgres (conversão de texto ISO → Date).
const COLUNAS_DATA: Record<string, string[]> = {
  usuarios: ["plano_expira_em", "criado_em", "atualizado_em"],
  sessoes: ["expira_em", "criado_em"],
  relatorios: ["criado_em"],
  achados_verificacao: ["criado_em"],
  retestes: ["criado_em"],
  webhook_eventos: ["processado_em"],
};

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT,
    plano TEXT NOT NULL DEFAULT 'free',
    plano_expira_em TIMESTAMPTZ,
    asaas_customer_id TEXT,
    asaas_subscription_id TEXT,
    assinatura_status TEXT,
    assinatura_ciclo TEXT,
    criado_em TIMESTAMPTZ DEFAULT now(),
    atualizado_em TIMESTAMPTZ DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS uso_mensal (
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    mes_ano TEXT NOT NULL,
    relatorios_criados INTEGER NOT NULL DEFAULT 0,
    retestes_registrados INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (usuario_id, mes_ano)
  );
  CREATE TABLE IF NOT EXISTS sessoes (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expira_em TIMESTAMPTZ NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS relatorios (
    id SERIAL PRIMARY KEY,
    cliente TEXT NOT NULL,
    titulo TEXT NOT NULL,
    data TEXT NOT NULL,
    versao TEXT NOT NULL,
    risco_geral TEXT NOT NULL,
    total_achados INTEGER NOT NULL,
    relatorio_json TEXT NOT NULL,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    criado_em TIMESTAMPTZ DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS achados_verificacao (
    id SERIAL PRIMARY KEY,
    relatorio_id INTEGER REFERENCES relatorios(id) ON DELETE CASCADE,
    achado_ref TEXT NOT NULL,
    titulo TEXT NOT NULL,
    severidade TEXT NOT NULL,
    cwe TEXT,
    confianca TEXT NOT NULL DEFAULT 'Media',
    data_reteste_sugerida TEXT,
    status TEXT NOT NULL DEFAULT 'pendente',
    criado_em TIMESTAMPTZ DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS retestes (
    id SERIAL PRIMARY KEY,
    achado_id INTEGER NOT NULL REFERENCES achados_verificacao(id) ON DELETE CASCADE,
    data_reteste TEXT NOT NULL,
    resultado TEXT NOT NULL,
    evidencia TEXT,
    criado_em TIMESTAMPTZ DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS webhook_eventos (
    id TEXT PRIMARY KEY,
    evento TEXT NOT NULL,
    payload TEXT NOT NULL,
    processado_em TIMESTAMPTZ DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_achados_status ON achados_verificacao(status);
  CREATE INDEX IF NOT EXISTS idx_achados_relatorio ON achados_verificacao(relatorio_id);
  CREATE INDEX IF NOT EXISTS idx_retestes_achado ON retestes(achado_id, data_reteste DESC);
  CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
  CREATE INDEX IF NOT EXISTS idx_relatorios_usuario ON relatorios(usuario_id);
  CREATE INDEX IF NOT EXISTS idx_sessoes_usuario ON sessoes(usuario_id);
  CREATE INDEX IF NOT EXISTS idx_sessoes_token ON sessoes(token_hash);
`;

function paraData(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v;
  const s = String(v).trim();
  if (!s) return null;
  // SQLite CURRENT_TIMESTAMP: "YYYY-MM-DD HH:MM:SS" → ISO UTC.
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)
    ? `${s.replace(" ", "T")}Z`
    : s;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function converterLinha(tabela: string, linha: Record<string, unknown>) {
  const saida: Record<string, unknown> = { ...linha };
  for (const col of COLUNAS_DATA[tabela] ?? []) {
    if (col in saida) saida[col] = paraData(saida[col]);
  }
  return saida;
}

function lerDotEnv(): void {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
    for (const linha of raw.split("\n")) {
      const m = linha.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // sem .env — usa só o ambiente
  }
}

async function main(): Promise<void> {
  const executar = process.argv.includes("--executar");
  lerDotEnv();

  const caminho = path.join(process.cwd(), "pentest.db");
  let sqlite: Database.Database;
  try {
    sqlite = new Database(caminho, { readonly: true });
  } catch (e) {
    console.error(`FALHA: não abri ${caminho}: ${e}`);
    process.exit(1);
  }

  // Dry-run: só contagens do SQLite (não precisa de DATABASE_URL).
  if (!executar) {
    const contagens: Record<string, number> = {};
    for (const t of TABELAS) {
      try {
        const l = sqlite.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as {
          n: number;
        };
        contagens[t] = Number(l.n);
      } catch {
        contagens[t] = -1; // tabela não existe no SQLite
      }
    }
    console.log("SQLite (origem):", JSON.stringify(contagens));
    console.log("Dry-run. Passe --executar para copiar para o Postgres.");
    sqlite.close();
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.error(
      "FALHA: DATABASE_URL não definida. Crie o banco no Neon (docs/DEPLOY.md) e cole a URL no .env.",
    );
    sqlite.close();
    process.exit(1);
  }

  const sql = postgres(process.env.DATABASE_URL, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 15,
  });
  const resumo: Record<string, { origem: number; destino: number }> = {};

  try {
    await sql.unsafe(SCHEMA_SQL);
    for (const tabela of TABELAS) {
      let linhas: Record<string, unknown>[];
      try {
        linhas = sqlite.prepare(`SELECT * FROM ${tabela}`).all() as Record<
          string,
          unknown
        >[];
      } catch {
        console.log(`Tabela ${tabela} não existe na origem — pulando.`);
        continue;
      }
      let inseridas = 0;
      for (const linha of linhas) {
        const conv = converterLinha(tabela, linha);
        const cols = Object.keys(conv);
        if (cols.length === 0) continue;
        try {
          await sql.unsafe(
            `INSERT INTO ${tabela} (${cols.join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}) ON CONFLICT DO NOTHING`,
            cols.map((c) => conv[c]) as never[],
          );
          inseridas++;
        } catch (e) {
          console.error(`Linha ignorada em ${tabela}: ${e}`);
        }
      }
      // Preserva a sequência do SERIAL para os próximos INSERTs.
      if ("id" in (linhas[0] ?? {}) && typeof linhas[0]?.id === "number") {
        await sql.unsafe(
          `SELECT setval(pg_get_serial_sequence('${tabela}', 'id'), COALESCE(MAX(id), 1)) FROM ${tabela}`,
        );
      }
      const r = await sql.unsafe(
        `SELECT COUNT(*)::int AS n FROM ${tabela}`,
      );
      const destino = Number((r[0] as unknown as { n: number }).n);
      resumo[tabela] = { origem: linhas.length, destino };
      console.log(
        `${tabela}: origem=${linhas.length} destino=${destino} (tentativas=${inseridas})`,
      );
    }
    console.log("Migração concluída:", JSON.stringify(resumo));
  } finally {
    sqlite.close();
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error("FALHA na migração:", e);
  process.exit(1);
});

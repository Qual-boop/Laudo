/**
 * Camada PostgreSQL (Neon) — preparação para o deploy.
 *
 * O ambiente local/testes continua usando SQLite (`lib/db.ts`, síncrono).
 * Este módulo espelha o MESMO schema em Postgres (tipos PG) e é usado por:
 *   - `scripts/migrar-dados.ts` (copia pentest.db → Neon)
 *   - futuras rotas em produção (quando DATABASE_URL estiver definida)
 *
 * Tabela SQLite → Postgres:
 *   INTEGER PK AUTOINCREMENT → SERIAL PRIMARY KEY
 *   TEXT                    → TEXT
 *   CURRENT_TIMESTAMP       → TIMESTAMPTZ DEFAULT now()
 *   datas ISO (TEXT)        → TIMESTAMPTZ (conversão no script de migração)
 *
 * Uso:
 *   import { sqlPg, criarSchemaPg } from "@/lib/db-pg";
 *   await criarSchemaPg(); // idempotente (CREATE TABLE IF NOT EXISTS)
 */

import postgres from "postgres";

let cliente: ReturnType<typeof postgres> | null = null;

export function sqlPg() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL não configurada. Configure o Postgres (Railway/Neon) e cole a URL no ambiente.",
    );
  }
  if (!cliente) {
    cliente = postgres(url, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 15,
    });
  }
  return cliente;
}

export async function fecharPg(): Promise<void> {
  if (cliente) {
    await cliente.end({ timeout: 5 });
    cliente = null;
  }
}

/** Cria todas as tabelas/índices no Postgres (idempotente). */
export async function criarSchemaPg(): Promise<void> {
  const sql = sqlPg();

  await sql`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha_hash TEXT,
      plano TEXT NOT NULL DEFAULT 'free',
      plano_expira_em TIMESTAMPTZ,
      trial_usado_em TIMESTAMPTZ,
      asaas_customer_id TEXT,
      asaas_subscription_id TEXT,
      assinatura_status TEXT,
      assinatura_ciclo TEXT,
      criado_em TIMESTAMPTZ DEFAULT now(),
      atualizado_em TIMESTAMPTZ DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS uso_mensal (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      mes_ano TEXT NOT NULL,
      relatorios_criados INTEGER NOT NULL DEFAULT 0,
      retestes_registrados INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (usuario_id, mes_ano)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sessoes (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expira_em TIMESTAMPTZ NOT NULL,
      criado_em TIMESTAMPTZ DEFAULT now()
    )
  `;

  await sql`
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
    )
  `;

  await sql`
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
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS retestes (
      id SERIAL PRIMARY KEY,
      achado_id INTEGER NOT NULL REFERENCES achados_verificacao(id) ON DELETE CASCADE,
      data_reteste TEXT NOT NULL,
      resultado TEXT NOT NULL,
      evidencia TEXT,
      criado_em TIMESTAMPTZ DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS webhook_eventos (
      id TEXT PRIMARY KEY,
      evento TEXT NOT NULL,
      payload TEXT NOT NULL,
      processado_em TIMESTAMPTZ DEFAULT now()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_achados_status ON achados_verificacao(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_achados_relatorio ON achados_verificacao(relatorio_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_retestes_achado ON retestes(achado_id, data_reteste DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_relatorios_usuario ON relatorios(usuario_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sessoes_usuario ON sessoes(usuario_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sessoes_token ON sessoes(token_hash)`;

  // Migração aditiva: link público do certificado (NULL = sem link).
  await sql`ALTER TABLE relatorios ADD COLUMN IF NOT EXISTS certificado_token TEXT`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_relatorios_certificado_token ON relatorios(certificado_token)`;

  // Equipe e evidências (ver lib/db.ts para o racional).
  await sql`
    CREATE TABLE IF NOT EXISTS compartilhamentos (
      relatorio_id INTEGER NOT NULL REFERENCES relatorios(id) ON DELETE CASCADE,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      papel TEXT NOT NULL DEFAULT 'revisor',
      criado_em TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (relatorio_id, usuario_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS comentarios (
      id SERIAL PRIMARY KEY,
      relatorio_id INTEGER NOT NULL REFERENCES relatorios(id) ON DELETE CASCADE,
      achado_ref TEXT,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      texto TEXT NOT NULL,
      criado_em TIMESTAMPTZ DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS evidencias (
      id SERIAL PRIMARY KEY,
      achado_id INTEGER NOT NULL REFERENCES achados_verificacao(id) ON DELETE CASCADE,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      legenda TEXT,
      mime TEXT NOT NULL,
      tamanho INTEGER NOT NULL,
      dados TEXT NOT NULL,
      criado_em TIMESTAMPTZ DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_compartilhamentos_usuario ON compartilhamentos(usuario_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_comentarios_relatorio ON comentarios(relatorio_id, id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_evidencias_achado ON evidencias(achado_id, id)`;

  // Migrações aditivas: cota de IA, plano assinado, e-mail verificado.
  await sql`ALTER TABLE uso_mensal ADD COLUMN IF NOT EXISTS geracoes_ia INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS assinatura_plano TEXT`;
  // Cobrança pelo Stripe (as colunas asaas_* ficam como legado, sem uso).
  await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`;
  await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT`;
  await sql`CREATE INDEX IF NOT EXISTS idx_usuarios_stripe_sub ON usuarios(stripe_subscription_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_usuarios_stripe_cus ON usuarios(stripe_customer_id)`;
  // Marca própria no PDF (ver lib/db.ts e lib/marca.ts).
  await sql`
    CREATE TABLE IF NOT EXISTS marcas (
      usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
      nome TEXT,
      cor TEXT,
      logo TEXT,
      responsavel TEXT,
      contato TEXT,
      atualizado_em TIMESTAMPTZ DEFAULT now()
    )
  `;
  await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_verificado_em TIMESTAMPTZ`;

  // Códigos por e-mail (ver lib/db.ts).
  await sql`
    CREATE TABLE IF NOT EXISTS codigos_email (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      finalidade TEXT NOT NULL,
      codigo_hash TEXT NOT NULL,
      expira_em TIMESTAMPTZ NOT NULL,
      tentativas INTEGER NOT NULL DEFAULT 0,
      usado_em TIMESTAMPTZ,
      criado_em TIMESTAMPTZ DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_codigos_usuario ON codigos_email(usuario_id, finalidade, id)`;
}

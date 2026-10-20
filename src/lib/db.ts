import Database from "better-sqlite3";
import path from "path";

/**
 * Banco local (SQLite). Usado em dev/testes e quando DATABASE_URL
 * NÃO está definida.
 *
 * Produção (Neon/Postgres): ver `lib/db-pg.ts` (mesmo schema em PG) e
 * `scripts/migrar-dados.ts` (copia pentest.db → Neon). A troca da camada
 * de acesso para Postgres acontece com DATABASE_URL configurada
 * (docs/DEPLOY.md); até lá este arquivo segue como fonte de verdade local.
 */

// SQLITE_PATH tira o banco da pasta do projeto: dentro dela, cada escrita
// dispara o watcher do `next dev`, que recompila e recarrega a página em
// ciclo. Sem a variável, mantém o caminho de sempre.
const db = new Database(
  process.env.SQLITE_PATH?.trim() || path.join(process.cwd(), "pentest.db"),
);

// Sem isso as cláusulas ON DELETE CASCADE abaixo seriam ignoradas:
// o better-sqlite3 (e o SQLite) deixa FKs desligadas por padrão.
db.pragma("foreign_keys = ON");

/* ------------------------------------------------------------
   Multi-usuário (SaaS).
   usuarios ← relatorios (usuario_id) ← achados_verificacao ← retestes.
   sessoes guarda hashes dos JWTs emitidos para clientes
   não-web (mobile/desktop), permitindo revogação (logout).
   ------------------------------------------------------------ */

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT,
    plano TEXT NOT NULL DEFAULT 'free',
    plano_expira_em TEXT,
    trial_usado_em TEXT,
    asaas_customer_id TEXT,
    asaas_subscription_id TEXT,
    assinatura_status TEXT,
    assinatura_ciclo TEXT,
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Uso mensal por plano (free: 3 relatórios + 10 retestes; reseta no mês).
db.exec(`
  CREATE TABLE IF NOT EXISTS uso_mensal (
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    mes_ano TEXT NOT NULL,
    relatorios_criados INTEGER NOT NULL DEFAULT 0,
    retestes_registrados INTEGER NOT NULL DEFAULT 0,
    geracoes_ia INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (usuario_id, mes_ano)
  )
`);
{
  const colunasUso = db.prepare("PRAGMA table_info(uso_mensal)").all() as { name: string }[];
  if (!colunasUso.some((c) => c.name === "geracoes_ia")) {
    db.exec("ALTER TABLE uso_mensal ADD COLUMN geracoes_ia INTEGER NOT NULL DEFAULT 0");
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS sessoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expira_em TEXT NOT NULL,
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

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
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
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

// Migração leve: bancos criados antes do multi-usuário não têm usuario_id.
const colunasRelatorios = db
  .prepare("PRAGMA table_info(relatorios)")
  .all() as { name: string }[];
if (!colunasRelatorios.some((c) => c.name === "usuario_id")) {
  db.exec("ALTER TABLE relatorios ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE");
}

// Migração leve: link público do certificado (token aleatório; NULL = sem link).
// SQLite não aceita UNIQUE no ADD COLUMN — a unicidade vem do índice abaixo.
if (!colunasRelatorios.some((c) => c.name === "certificado_token")) {
  db.exec("ALTER TABLE relatorios ADD COLUMN certificado_token TEXT");
}
db.exec(
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_relatorios_certificado_token ON relatorios(certificado_token)",
);

// Migração leve: plano default 'free' para contas anteriores aos limites.
const colunasUsuarios = db
  .prepare("PRAGMA table_info(usuarios)")
  .all() as { name: string }[];
if (!colunasUsuarios.some((c) => c.name === "plano")) {
  db.exec("ALTER TABLE usuarios ADD COLUMN plano TEXT NOT NULL DEFAULT 'free'");
}
if (!colunasUsuarios.some((c) => c.name === "plano_expira_em")) {
  db.exec("ALTER TABLE usuarios ADD COLUMN plano_expira_em TEXT");
}

// Migração leve: billing. As colunas asaas_* são legado do provedor
// anterior (ficam, sem uso); a cobrança atual é pelo Stripe.
for (const [coluna, tipo] of [
  ["asaas_customer_id", "TEXT"],
  ["asaas_subscription_id", "TEXT"],
  ["stripe_customer_id", "TEXT"],
  ["stripe_subscription_id", "TEXT"],
  ["assinatura_status", "TEXT"],
  ["assinatura_ciclo", "TEXT"],
  // Trial é uma vez por conta: sobrevive a pagar→cancelar (plano_expira_em
  // é zerado no cancelamento, este carimbo não).
  ["trial_usado_em", "TEXT"],
  // Plano assinado (pro/team): o downgrade por expiração zera `plano`, e
  // um pagamento atrasado precisa saber qual plano devolver.
  ["assinatura_plano", "TEXT"],
  // Primeiro código de e-mail confirmado = e-mail comprovado.
  ["email_verificado_em", "TEXT"],
] as const) {
  const atuais = db.prepare("PRAGMA table_info(usuarios)").all() as { name: string }[];
  if (!atuais.some((c) => c.name === coluna)) {
    db.exec(`ALTER TABLE usuarios ADD COLUMN ${coluna} ${tipo}`);
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS webhook_eventos (
    id TEXT PRIMARY KEY,
    evento TEXT NOT NULL,
    payload TEXT NOT NULL,
    processado_em TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Índices das consultas mais frequentes da aba Verificação.
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_achados_status ON achados_verificacao(status);
  CREATE INDEX IF NOT EXISTS idx_achados_relatorio ON achados_verificacao(relatorio_id);
  CREATE INDEX IF NOT EXISTS idx_retestes_achado ON retestes(achado_id, data_reteste DESC);
`);

// Índices multi-tenant e de auth.
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
  CREATE INDEX IF NOT EXISTS idx_relatorios_usuario ON relatorios(usuario_id);
  CREATE INDEX IF NOT EXISTS idx_sessoes_usuario ON sessoes(usuario_id);
  CREATE INDEX IF NOT EXISTS idx_sessoes_token ON sessoes(token_hash);
`);


/* ------------------------------------------------------------
   Equipe e evidências.
   compartilhamentos: colegas com acesso de revisão a um relatório.
   comentarios: revisão por pares (por achado ou do relatório).
   evidencias: prints com tarja aplicada no navegador (base64 —
   portável entre SQLite e Postgres; teto de tamanho na API).
   ------------------------------------------------------------ */
db.exec(`
  CREATE TABLE IF NOT EXISTS compartilhamentos (
    relatorio_id INTEGER NOT NULL REFERENCES relatorios(id) ON DELETE CASCADE,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    papel TEXT NOT NULL DEFAULT 'revisor',
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (relatorio_id, usuario_id)
  );
  CREATE TABLE IF NOT EXISTS comentarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    relatorio_id INTEGER NOT NULL REFERENCES relatorios(id) ON DELETE CASCADE,
    achado_ref TEXT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    texto TEXT NOT NULL,
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS evidencias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    achado_id INTEGER NOT NULL REFERENCES achados_verificacao(id) ON DELETE CASCADE,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    legenda TEXT,
    mime TEXT NOT NULL,
    tamanho INTEGER NOT NULL,
    dados TEXT NOT NULL,
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_compartilhamentos_usuario ON compartilhamentos(usuario_id);
  CREATE INDEX IF NOT EXISTS idx_comentarios_relatorio ON comentarios(relatorio_id, id);
  CREATE INDEX IF NOT EXISTS idx_evidencias_achado ON evidencias(achado_id, id);
`);

/* ------------------------------------------------------------
   Códigos por e-mail (login em 2 etapas e troca de senha).
   Só o HMAC do código fica no banco; tentativas erradas contam
   e queimam o código na 5ª.
   ------------------------------------------------------------ */
db.exec(`
  CREATE TABLE IF NOT EXISTS codigos_email (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    finalidade TEXT NOT NULL,
    codigo_hash TEXT NOT NULL,
    expira_em TEXT NOT NULL,
    tentativas INTEGER NOT NULL DEFAULT 0,
    usado_em TEXT,
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_codigos_usuario ON codigos_email(usuario_id, finalidade, id);
`);

/* Marca própria no PDF (Pro/Team). Tabela à parte: o logo (data URL) não
   pode pesar no SELECT * de usuarios, que roda a cada requisição. */
db.exec(`
  CREATE TABLE IF NOT EXISTS marcas (
    usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    nome TEXT,
    cor TEXT,
    logo TEXT,
    responsavel TEXT,
    contato TEXT,
    atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

export default db;

import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Camada única de acesso a dados do app.
 *
 * Backend escolhido por ambiente:
 *   - DATABASE_URL definida → PostgreSQL (produção: Railway/Neon)
 *   - sem DATABASE_URL      → SQLite local (dev/testes, via lib/db.ts)
 *
 * Toda a API é assíncrona. Dentro de `transacao()`, as operações seguem a
 * MESMA conexão/transação (AsyncLocalStorage) — tanto no Postgres quanto
 * no SQLite (mutex + BEGIN/COMMIT, já que o better-sqlite3 usa uma só
 * conexão síncrona).
 */

export type Dialeto = "sqlite" | "pg";

export function dialeto(): Dialeto {
  return process.env.DATABASE_URL ? "pg" : "sqlite";
}

export function usandoPostgres(): boolean {
  return dialeto() === "pg";
}

export type Linha = Record<string, unknown>;

export type ClienteBanco = {
  buscar(sql: string, params: unknown[]): Promise<Linha | undefined>;
  buscarTodos(sql: string, params: unknown[]): Promise<Linha[]>;
  executar(sql: string, params: unknown[]): Promise<number>;
  inserir(sql: string, params: unknown[]): Promise<number>;
};

const emTransacao = new AsyncLocalStorage<ClienteBanco>();

async function clienteAtual(): Promise<ClienteBanco> {
  const atual = emTransacao.getStore();
  if (atual) return atual;
  if (usandoPostgres()) return (await import("@/lib/banco-pg")).cliente();
  return (await import("@/lib/banco-sqlite")).cliente();
}

/** Primeira linha ou undefined. */
export async function buscarUm<T = Linha>(
  sql: string,
  ...params: unknown[]
): Promise<T | undefined> {
  const cliente = await clienteAtual();
  return (await cliente.buscar(sql, params)) as T | undefined;
}

/** Todas as linhas. */
export async function buscarTodos<T = Linha>(
  sql: string,
  ...params: unknown[]
): Promise<T[]> {
  const cliente = await clienteAtual();
  return (await cliente.buscarTodos(sql, params)) as T[];
}

/** INSERT/UPDATE/DELETE. Retorna o número de linhas afetadas. */
export async function executar(sql: string, ...params: unknown[]): Promise<number> {
  const cliente = await clienteAtual();
  return cliente.executar(sql, params);
}

/** INSERT que precisa do id gerado (RETURNING id no Postgres). */
export async function inserir(sql: string, ...params: unknown[]): Promise<number> {
  const cliente = await clienteAtual();
  return cliente.inserir(sql, params);
}

/**
 * Executa `fn` numa transação. Chamadas aninhadas reaproveitam a mesma
 * transação (não abre uma segunda).
 */
export async function transacao<T>(fn: () => Promise<T>): Promise<T> {
  if (emTransacao.getStore()) return fn();
  const { iniciarTransacao } = usandoPostgres()
    ? await import("@/lib/banco-pg")
    : await import("@/lib/banco-sqlite");
  return iniciarTransacao((cliente) => emTransacao.run(cliente, fn));
}

import type { Database } from "better-sqlite3";
import type { ClienteBanco } from "@/lib/banco";

/**
 * Backend SQLite (dev/testes): lib/db.ts (better-sqlite3, síncrono) por trás
 * da API assíncrona de lib/banco.ts.
 *
 * Import dinâmico de propósito: em produção (DATABASE_URL definida) este
 * módulo nunca é carregado e o binário nativo do better-sqlite3 fica fora
 * do runtime.
 */

let base: Database | null = null;
let abertura: Promise<Database> | null = null;

async function abrir(): Promise<Database> {
  if (base) return base;
  if (!abertura) {
    abertura = import("@/lib/db").then((modulo) => {
      base = modulo.default;
      return base;
    });
  }
  return abertura;
}

const clienteLocal: ClienteBanco = {
  async buscar(sql, params) {
    const db = await abrir();
    return db.prepare(sql).get(...(params as never[])) as
      | Record<string, unknown>
      | undefined;
  },

  async buscarTodos(sql, params) {
    const db = await abrir();
    return db.prepare(sql).all(...(params as never[])) as Record<
      string,
      unknown
    >[];
  },

  async executar(sql, params) {
    const db = await abrir();
    const info = db.prepare(sql).run(...(params as never[]));
    return Number(info.changes);
  },

  async inserir(sql, params) {
    const db = await abrir();
    const info = db.prepare(sql).run(...(params as never[]));
    return Number(info.lastInsertRowid);
  },
};

export async function cliente(): Promise<ClienteBanco> {
  await abrir();
  return clienteLocal;
}

/* Uma conexão só: transações são serializadas numa fila para nunca
   aninharem um BEGIN dentro de outro. */

let fila: Promise<unknown> = Promise.resolve();

async function naFila<T>(fn: () => Promise<T>): Promise<T> {
  const anterior = fila;
  let liberar!: () => void;
  fila = new Promise<void>((resolve) => {
    liberar = resolve;
  });
  await anterior;
  try {
    return await fn();
  } finally {
    liberar();
  }
}

export async function iniciarTransacao<T>(
  fn: (cliente: ClienteBanco) => Promise<T>,
): Promise<T> {
  return naFila(async () => {
    const db = await abrir();
    db.exec("BEGIN");
    try {
      const resultado = await fn(clienteLocal);
      db.exec("COMMIT");
      return resultado;
    } catch (erro) {
      try {
        db.exec("ROLLBACK");
      } catch {
        // conexão já quebrada — o erro original é o que importa
      }
      throw erro;
    }
  });
}

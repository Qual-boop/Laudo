import { criarSchemaPg, sqlPg } from "@/lib/db-pg";
import type { ClienteBanco, Linha } from "@/lib/banco";

/**
 * Backend PostgreSQL (produção: Railway/Neon).
 *
 * - adapta os `?` dos SQLs para `$1..$n` (postgres.js usa placeholders
 *   numerados) — os SQLs da app são literais simples, sem `?` em strings;
 * - normaliza datas lidas (timestamptz vira Date no driver) para ISO 8601,
 *   que é o formato que o resto da app espera;
 * - garante o schema na primeira consulta (idempotente).
 */

type ExecutorPg = {
  unsafe(query: string, params?: unknown[]): Promise<Linha[]>;
};

let schemaGarantido: Promise<void> | null = null;

function garantirSchema(): Promise<void> {
  if (!schemaGarantido) {
    schemaGarantido = criarSchemaPg().catch((erro) => {
      schemaGarantido = null;
      throw erro;
    });
  }
  return schemaGarantido;
}

function adaptar(sql: string): string {
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
}

function normalizar(linha: Linha): Linha {
  const saida: Linha = {};
  for (const [chave, valor] of Object.entries(linha)) {
    saida[chave] = valor instanceof Date ? valor.toISOString() : valor;
  }
  return saida;
}

function clienteDe(exec: ExecutorPg): ClienteBanco {
  return {
    async buscar(sql, params) {
      await garantirSchema();
      const linhas = await exec.unsafe(adaptar(sql), params);
      return linhas[0] ? normalizar(linhas[0]) : undefined;
    },

    async buscarTodos(sql, params) {
      await garantirSchema();
      const linhas = await exec.unsafe(adaptar(sql), params);
      return linhas.map((linha) => normalizar(linha));
    },

    async executar(sql, params) {
      await garantirSchema();
      const resultado = (await exec.unsafe(
        adaptar(sql),
        params,
      )) as unknown as { count?: number };
      return Number(resultado.count ?? 0);
    },

    async inserir(sql, params) {
      await garantirSchema();
      const linhas = await exec.unsafe(`${adaptar(sql)} RETURNING id`, params);
      const id = Number((linhas[0] as { id?: unknown } | undefined)?.id);
      if (!Number.isInteger(id)) {
        throw new Error("INSERT não retornou id no Postgres.");
      }
      return id;
    },
  };
}

let padrao: ClienteBanco | null = null;

export function cliente(): ClienteBanco {
  if (!padrao) padrao = clienteDe(sqlPg() as unknown as ExecutorPg);
  return padrao;
}

export async function iniciarTransacao<T>(
  fn: (cliente: ClienteBanco) => Promise<T>,
): Promise<T> {
  const sql = sqlPg();
  return sql.begin(async (tx) =>
    fn(clienteDe(tx as unknown as ExecutorPg)),
  ) as Promise<T>;
}

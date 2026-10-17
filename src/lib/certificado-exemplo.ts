import type { DadosCertificado } from "@/lib/certificado";

/**
 * Certificado fictício exibido na landing. HASH_EXEMPLO é o SHA-256 real
 * destes dados (`hashCertificado`) — o teste ao lado garante que os dois
 * nunca divergem. Mudou um campo? Rode o teste e atualize o hash.
 */
export const CERTIFICADO_EXEMPLO: DadosCertificado = {
  relatorio: {
    id: 1042,
    cliente: "Acme Pagamentos Ltda.",
    titulo: "Pentest Web — Portal do Cliente",
    data: "2026-10-06",
    versao: "2.1",
  },
  achados: [
    {
      ref: "FINDING-001",
      titulo: "SQL Injection no formulário de login",
      severidade: "Critica",
      status: "verificado",
      dataReteste: "2026-10-09",
      resultado: "corrigido",
    },
    {
      ref: "FINDING-002",
      titulo: "IDOR no endpoint de faturas",
      severidade: "Alta",
      status: "verificado",
      dataReteste: "2026-10-14",
      resultado: "corrigido",
    },
    {
      ref: "FINDING-003",
      titulo: "Cookie de sessão sem HttpOnly",
      severidade: "Media",
      status: "verificado",
      dataReteste: "2026-10-14",
      resultado: "corrigido",
    },
  ],
  emitidoEm: "2026-10-16",
};

export const HASH_EXEMPLO =
  "b5c6f31304e97ed25cb3ea636097a41ec5ca475b74591346643343d9d7062e44";

import { describe, expect, it } from "vitest";
import { calcularMetricas, estaAtrasado } from "@/lib/metricas";
import type { AchadoVerificavel, ResultadoReteste, Severidade, StatusVerificacao } from "@/lib/tipos";

const HOJE = new Date(2026, 9, 18);

function achado(
  id: number,
  severidade: Severidade,
  status: StatusVerificacao,
  criado: string,
  retesteEm?: string,
): AchadoVerificavel {
  return {
    id,
    relatorio_id: 1,
    cliente: "Cliente",
    achado_ref: `FINDING-${id}`,
    titulo: `Achado ${id}`,
    severidade,
    cwe: "",
    confianca: "Media",
    data_reteste_sugerida: null,
    status,
    criado_em: criado,
    ultimo_reteste: retesteEm
      ? ({
          id,
          achado_id: id,
          data_reteste: retesteEm,
          resultado: "corrigido" as ResultadoReteste,
          evidencia: "",
          criado_em: retesteEm,
        } as unknown as AchadoVerificavel["ultimo_reteste"])
      : null,
    total_retestes: retesteEm ? 1 : 0,
  };
}

const LISTA = [
  achado(1, "Critica", "verificado", "2026-10-01", "2026-10-05"), // 4 dias
  achado(2, "Alta", "verificado", "2026-09-20", "2026-10-10"), // 20 dias
  achado(3, "Critica", "pendente", "2026-10-01"), // venceu 08/10 → atrasado
  achado(4, "Alta", "nao-corrigido", "2026-09-20"), // vence 20/10 → vence logo
  achado(5, "Media", "pendente", "2026-10-15"), // no prazo
];

describe("calcularMetricas", () => {
  const m = calcularMetricas(LISTA, HOJE);

  it("conta corrigidos, abertos e a taxa", () => {
    expect(m.total).toBe(5);
    expect(m.verificados).toBe(2);
    expect(m.abertos).toBe(3);
    expect(m.taxaCorrecao).toBe(40);
  });

  it("tempo médio de correção usa a entrega e o reteste que confirmou", () => {
    expect(m.tempoMedioCorrecaoDias).toBe(12);
  });

  it("separa atrasados de quem vence logo", () => {
    expect(m.atrasados).toBe(1);
    expect(m.venceLogo).toBe(1);
  });

  it("abertos por severidade ignoram os verificados", () => {
    expect(m.abertosPorSeveridade).toEqual({ Critica: 1, Alta: 1, Media: 1, Baixa: 0 });
  });

  it("lista vazia não divide por zero", () => {
    const vazio = calcularMetricas([], HOJE);
    expect(vazio.taxaCorrecao).toBe(0);
    expect(vazio.tempoMedioCorrecaoDias).toBeNull();
  });

  it("estaAtrasado nunca marca achado verificado", () => {
    expect(estaAtrasado(LISTA[2], HOJE)).toBe(true);
    expect(estaAtrasado(achado(9, "Critica", "verificado", "2026-01-01", "2026-01-02"), HOJE)).toBe(false);
  });
});

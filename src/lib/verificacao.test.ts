import { describe, expect, it } from "vitest";
import {
  ESTILO_STATUS,
  ROTULO_CONFIANCA,
  ROTULO_RESULTADO,
  ROTULO_STATUS,
  montarDelta,
  normalizarConfianca,
  rotuloResultado,
  statusParaResultado,
} from "@/lib/verificacao";
import type { AchadoVerificavel, ResultadoReteste } from "@/lib/tipos";

function achadoBase(over: Partial<AchadoVerificavel> = {}): AchadoVerificavel {
  return {
    id: 1,
    relatorio_id: 10,
    cliente: "Acme Corp",
    achado_ref: "FINDING-001",
    titulo: "SQL Injection no login",
    severidade: "Critica",
    cwe: "CWE-89",
    confianca: "Alta",
    data_reteste_sugerida: "2026-11-01",
    status: "pendente",
    criado_em: "2026-10-09 12:00:00",
    ultimo_reteste: null,
    total_retestes: 0,
    ...over,
  };
}

function retesteBase(over = {}) {
  return {
    id: 5,
    achado_id: 1,
    data_reteste: "2026-11-15",
    resultado: "corrigido" as ResultadoReteste,
    evidencia: "payload agora retorna 400",
    criado_em: "2026-11-15 09:00:00",
    ...over,
  };
}

describe("statusParaResultado", () => {
  it("só 'corrigido' marca como verificado", () => {
    expect(statusParaResultado("corrigido")).toBe("verificado");
  });

  it("'parcial' NÃO marca como verificado — é a decisão mais importante aqui", () => {
    // Um achado parcialmente corrigido continua em aberto. Se este teste
    // mudar, o painel passa a declarar uma correção que não aconteceu.
    expect(statusParaResultado("parcial")).toBe("nao-corrigido");
  });

  it("'nao-corrigido' permanece em aberto", () => {
    expect(statusParaResultado("nao-corrigido")).toBe("nao-corrigido");
  });
});

describe("normalizarConfianca", () => {
  it("aceita as grafias canônicas", () => {
    expect(normalizarConfianca("Alta")).toBe("Alta");
    expect(normalizarConfianca("Media")).toBe("Media");
    expect(normalizarConfianca("Baixa")).toBe("Baixa");
  });

  it("aceita acento e caixa-varying", () => {
    expect(normalizarConfianca("média")).toBe("Media");
    expect(normalizarConfianca("ALTA")).toBe("Alta");
    expect(normalizarConfianca("baixa")).toBe("Baixa");
  });

  it("usa prefixo, então aceita anotações como 'Alta (alta confiança)'", () => {
    expect(normalizarConfianca("Alta (alta confiança)")).toBe("Alta");
    expect(normalizarConfianca("Baixa — validação parcial")).toBe("Baixa");
  });

  it("cai em Média para valor desconhecido ou vazio", () => {
    expect(normalizarConfianca("moderado")).toBe("Media");
    expect(normalizarConfianca("confiança desconhecida")).toBe("Media");
    expect(normalizarConfianca(undefined)).toBe("Media");
    expect(normalizarConfianca(null)).toBe("Media");
    expect(normalizarConfianca("")).toBe("Media");
    expect(normalizarConfianca(42)).toBe("Media");
  });
});

describe("rótulos", () => {
  it("cobre os três resultados e os três status", () => {
    expect(Object.keys(ROTULO_RESULTADO).sort()).toEqual([
      "corrigido",
      "nao-corrigido",
      "parcial",
    ]);
    expect(Object.keys(ROTULO_STATUS).sort()).toEqual([
      "nao-corrigido",
      "pendente",
      "verificado",
    ]);
    expect(Object.keys(ESTILO_STATUS).sort()).toEqual([
      "nao-corrigido",
      "pendente",
      "verificado",
    ]);
  });

  it("cada status tem estilo próprio (amarelo, verde, vermelho)", () => {
    expect(ESTILO_STATUS.pendente).toContain("media");
    expect(ESTILO_STATUS.verificado).toContain("accent");
    expect(ESTILO_STATUS["nao-corrigido"]).toContain("critica");
  });

  it("traduz acentos nos rótulos", () => {
    expect(ROTULO_CONFIANCA.Media).toBe("Média");
    expect(ROTULO_STATUS["nao-corrigido"]).toBe("Não corrigido");
    expect(rotuloResultado("nao-corrigido")).toBe("Não corrigido");
  });
});

describe("montarDelta", () => {
  it("devolve null sem reteste — não há delta para o que não mudou", () => {
    expect(montarDelta(achadoBase())).toBeNull();
    expect(
      montarDelta(achadoBase({ ultimo_reteste: null, status: "pendente" })),
    ).toBeNull();
  });

  it("monta o delta completo a partir do último reteste", () => {
    const delta = montarDelta(
      achadoBase({
        status: "verificado",
        ultimo_reteste: retesteBase(),
        total_retestes: 1,
      }),
    );

    expect(delta).not.toBeNull();
    expect(delta!.achado.titulo).toBe("SQL Injection no login");
    expect(delta!.achado.severidade).toBe("Critica");
    expect(delta!.achado.achadoRef).toBe("FINDING-001");
    expect(delta!.achado.confianca).toBe("Alta");
    expect(delta!.achado.cliente).toBe("Acme Corp");
    expect(delta!.achado.dataOriginal).toBe("2026-10-09");
    expect(delta!.reteste.data).toBe("2026-11-15");
    expect(delta!.reteste.resultado).toBe("corrigido");
    expect(delta!.reteste.rotulo).toBe("Corrigido");
    expect(delta!.reteste.evidencia).toBe("payload agora retorna 400");
    expect(delta!.statusFinal).toBe("verificado");
    expect(delta!.statusFinalRotulo).toBe("Verificado");
  });

  it("preserva o detalhe 'Parcial' no delta, mesmo com status em aberto", () => {
    const delta = montarDelta(
      achadoBase({
        status: "nao-corrigido",
        ultimo_reteste: retesteBase({ resultado: "parcial" }),
      }),
    );

    expect(delta!.reteste.resultado).toBe("parcial");
    expect(delta!.reteste.rotulo).toBe("Parcial");
    expect(delta!.statusFinal).toBe("nao-corrigido");
  });

  it("funciona com achado sem cliente e sem data sugerida", () => {
    const delta = montarDelta(
      achadoBase({
        cliente: "",
        data_reteste_sugerida: null,
        status: "verificado",
        ultimo_reteste: retesteBase({ evidencia: "" }),
      }),
    );

    expect(delta!.achado.cliente).toBe("");
    expect(delta!.reteste.evidencia).toBe("");
  });
});

import { describe, expectTypeOf, it } from "vitest";
import type {
  Achado,
  AchadoEntrada,
  AchadoVerificavel,
  Confianca,
  DeltaRelatorio,
  ResultadoReteste,
  Reteste,
  StatusVerificacao,
} from "@/lib/tipos";
import { montarDelta, statusParaResultado } from "@/lib/verificacao";

describe("tipos da verificação", () => {
  it("Confiança tem exatamente três valores", () => {
    expectTypeOf<Confianca>().toEqualTypeOf<"Alta" | "Media" | "Baixa">();
  });

  it("StatusVerificacao tem exatamente os três estados do painel", () => {
    expectTypeOf<StatusVerificacao>().toEqualTypeOf<
      "pendente" | "verificado" | "nao-corrigido"
    >();
  });

  it("ResultadoReteste inclui 'parcial'", () => {
    expectTypeOf<ResultadoReteste>().toEqualTypeOf<
      "corrigido" | "nao-corrigido" | "parcial"
    >();
  });

  it("Achado carrega os metadados de verificação", () => {
    expectTypeOf<Achado["confianca"]>().toEqualTypeOf<Confianca>();
    expectTypeOf<Achado["dataRetesteSugerida"]>().toEqualTypeOf<string | null>();
  });

  it("AchadoEntrada também, com a data como string (vinda do input date)", () => {
    expectTypeOf<AchadoEntrada["confianca"]>().toEqualTypeOf<Confianca>();
    expectTypeOf<AchadoEntrada["dataRetesteSugerida"]>().toEqualTypeOf<string>();
  });

  it("AchadoVerificavel traz o último reteste embutido", () => {
    expectTypeOf<AchadoVerificavel["ultimo_reteste"]>().toEqualTypeOf<
      Reteste | null
    >();
    expectTypeOf<AchadoVerificavel["status"]>().toEqualTypeOf<StatusVerificacao>();
    expectTypeOf<AchadoVerificavel["total_retestes"]>().toEqualTypeOf<number>();
  });

  it("DeltaRelatorio tem as três partes pedidas", () => {
    expectTypeOf<DeltaRelatorio["achado"]>().toHaveProperty("titulo");
    expectTypeOf<DeltaRelatorio["reteste"]>().toHaveProperty("resultado");
    expectTypeOf<DeltaRelatorio["statusFinal"]>().toEqualTypeOf<StatusVerificacao>();
  });

  it("statusParaResultado só devolve status válidos", () => {
    expectTypeOf(statusParaResultado).returns.toEqualTypeOf<StatusVerificacao>();
  });

  it("montarDelta devolve DeltaRelatorio ou null", () => {
    expectTypeOf(montarDelta).returns.toEqualTypeOf<DeltaRelatorio | null>();
  });

  it("rejeita estados fora do contrato", () => {
    // @ts-expect-error não existe estado "em_andamento"
    const estado: StatusVerificacao = "em_andamento";
    // @ts-expect-error resultado minúsculo não é aceito
    const resultado: ResultadoReteste = "corrigido ";
    // @ts-expect-error confiança com acento não é valor válido
    const confianca: Confianca = "Média";
    expectTypeOf([estado, resultado, confianca]).toBeArray();
  });
});

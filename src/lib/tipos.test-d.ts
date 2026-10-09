/**
 * Validação de tipos do contrato do relatório.
 *
 * `tipos.ts` não tem código em runtime — são tipos apagados na compilação.
 * Estes testes são checados pelo typechecker (`vitest --typecheck`), não em
 * runtime. Rodam em tempo de compilação junto com `tsc --noEmit`.
 */
import { describe, expectTypeOf, it } from "vitest";
import { contarPorSeveridade, riscoGeralDe } from "@/lib/relatorio";
import type {
  Achado,
  AchadoEntrada,
  Capa,
  Remediacao,
  RecomendacaoGeral,
  Relatorio,
  RelatorioEntrada,
  ResumoPorSeveridade,
  RiscoGeral,
  Severidade,
  SumarioExecutivo,
} from "@/lib/tipos";

const SEVERIDADES: Severidade[] = ["Critica", "Alta", "Media", "Baixa"];
const RISCOS: RiscoGeral[] = ["Critico", "Alto", "Medio", "Baixo"];

describe("tipos do relatório", () => {
  it("Relatorio tem exatamente as sete seções do contrato", () => {
    expectTypeOf<Relatorio>().toEqualTypeOf<{
      capa: Capa;
      sumarioExecutivo: SumarioExecutivo;
      escopoMetodologia: import("@/lib/tipos").EscopoMetodologia;
      achados: Achado[];
      recomendacoesGerais: RecomendacaoGeral[];
      conclusao: string;
      disclaimer: string;
    }>();
  });

  it("Capa tem os cinco campos de identificação", () => {
    expectTypeOf<Capa>().toEqualTypeOf<{
      titulo: string;
      cliente: string;
      data: string;
      versao: string;
      classificacao: string;
    }>();
  });

  it("SumarioExecutivo exige contadores e riscos", () => {
    expectTypeOf<SumarioExecutivo["visaoGeral"]>().toEqualTypeOf<string>();
    expectTypeOf<SumarioExecutivo["riscoGeral"]>().toEqualTypeOf<RiscoGeral>();
    expectTypeOf<SumarioExecutivo["totalAchados"]>().toEqualTypeOf<number>();
    expectTypeOf<SumarioExecutivo["resumoPorSeveridade"]>().toEqualTypeOf<ResumoPorSeveridade>();
    expectTypeOf<SumarioExecutivo["principaisRiscos"]>().toEqualTypeOf<string[]>();
  });

  it("ResumoPorSeveridade cobre os quatro níveis", () => {
    expectTypeOf<ResumoPorSeveridade>().toEqualTypeOf<{
      critica: number;
      alta: number;
      media: number;
      baixa: number;
    }>();
  });

  it("Achado traz CVSS aninhado e remediação completa", () => {
    expectTypeOf<Achado["id"]>().toEqualTypeOf<string>();
    expectTypeOf<Achado["severidade"]>().toEqualTypeOf<Severidade>();
    expectTypeOf<Achado["cvss"]>().toEqualTypeOf<{ score: number; vetor: string }>();
    expectTypeOf<Achado["passosReproducao"]>().toEqualTypeOf<string[]>();
    expectTypeOf<Achado["remediacao"]>().toEqualTypeOf<Remediacao>();
    expectTypeOf<Remediacao["curtoPrazo"]>().toEqualTypeOf<string>();
    expectTypeOf<Remediacao["longoPrazo"]>().toEqualTypeOf<string>();
    expectTypeOf<Remediacao["referencias"]>().toEqualTypeOf<string[]>();
  });

  it("RecomendacaoGeral tem prioridade tipada", () => {
    expectTypeOf<RecomendacaoGeral>().toEqualTypeOf<{
      prioridade: Severidade;
      recomendacao: string;
      justificativa: string;
    }>();
  });

  it("RelatorioEntrada é o que o formulário coleta — mais enxuto que Achado", () => {
    expectTypeOf<RelatorioEntrada>().toEqualTypeOf<{
      cliente: string;
      titulo: string;
      escopo: string;
      periodo: string;
      limitacoes: string;
      ferramentas: string;
      achados: AchadoEntrada[];
    }>();
    // O pentester não informa os campos derivados pela IA.
    expectTypeOf<AchadoEntrada>().not.toHaveProperty("cvss");
    expectTypeOf<AchadoEntrada>().not.toHaveProperty("owasp");
    expectTypeOf<AchadoEntrada>().not.toHaveProperty("passosReproducao");
  });

  it("contarPorSeveridade devolve as mesmas chaves do resumo", () => {
    expectTypeOf(contarPorSeveridade).returns.toEqualTypeOf<ResumoPorSeveridade>();
  });

  it("riscoGeralDe devolve um RiscoGeral válido", () => {
    expectTypeOf(riscoGeralDe).returns.toEqualTypeOf<RiscoGeral>();
  });
});

describe("união discriminada de severidade", () => {
  it("aceita exatamente os quatro valores canônicos", () => {
    for (const s of SEVERIDADES) expectTypeOf(s).toMatchTypeOf<Severidade>();
    for (const r of RISCOS) expectTypeOf(r).toMatchTypeOf<RiscoGeral>();
  });

  it("rejeita grafias fora da união", () => {
    // @ts-expect-error "Crítica" com acento não é um valor válido de Severidade.
    const comAcento: Severidade = "Crítica";
    // @ts-expect-error minúsculo não é aceito.
    const minusculo: Severidade = "critica";
    // @ts-expect-error "Moderado" não existe no contrato.
    const inexistente: Severidade = "Moderado";
    expectTypeOf([comAcento, minusculo, inexistente]).toBeArray();
  });
});

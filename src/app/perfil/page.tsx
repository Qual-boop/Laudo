"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/Card";
import { Spinner } from "@/components/Spinner";
import { Logo } from "@/components/Logo";

type Assinatura = {
  plano: "free" | "pro" | "team";
  expiraEm: string | null;
  subscriptionId: string | null;
  trial: boolean;
};

type Uso = {
  relatorios: { usados: number; limite: number | null };
  retestes: { usados: number; limite: number | null };
};

function formatarLimite(n: number | null): string {
  return typeof n === "number" && Number.isFinite(n) ? String(n) : "∞";
}

/** /perfil — plano atual, uso, trial, checkout e portal. */
export default function Perfil() {
  const { data: sessao } = useSession();
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [uso, setUso] = useState<Uso | null>(null);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [aguarde, setAguarde] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [a, u] = await Promise.all([
        fetch("/api/v1/assinatura").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/v1/uso").then((r) => (r.ok ? r.json() : null)),
      ]);
      if (a) setAssinatura(a as Assinatura);
      if (u) setUso(u as Uso);
    } catch {
      // silencioso: a página mostra estado vazio
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function pagar(plano: "pro" | "team", periodo: "mensal" | "anual") {
    setErro("");
    setOk("");
    setAguarde(`pagar-${plano}-${periodo}`);
    try {
      const res = await fetch("/api/v1/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano, periodo }),
      });
      const corpo = (await res.json().catch(() => null)) as {
        url?: string;
        error?: string;
      } | null;
      if (!res.ok || !corpo?.url) {
        setErro(corpo?.error ?? "Checkout indisponível no momento.");
        return;
      }
      window.location.href = corpo.url;
    } catch {
      setErro("Não foi possível conectar ao servidor.");
    } finally {
      setAguarde(null);
    }
  }

  async function abrirPortal() {
    setErro("");
    setAguarde("portal");
    try {
      // O Asaas não tem Customer Portal: o cancelamento é via API e as
      // faturas ficam no painel do Asaas. Aqui, "gerenciar" = cancelar.
      const res = await fetch("/api/v1/assinatura/cancelar", { method: "POST" });
      const corpo = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !corpo?.ok) {
        setErro(corpo?.error ?? "Cancelamento indisponível no momento.");
        return;
      }
      setOk("Assinatura cancelada. Você voltou para o Free.");
      await carregar();
    } catch {
      setErro("Não foi possível conectar ao servidor.");
    } finally {
      setAguarde(null);
    }
  }

  async function testarPro() {
    setErro("");
    setOk("");
    setAguarde("trial");
    try {
      const res = await fetch("/api/v1/assinatura/testar-pro", { method: "POST" });
      const corpo = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        setErro(corpo?.error ?? "Trial indisponível.");
        return;
      }
      setOk("Pro ativado por 30 dias. Aproveite!");
      await carregar();
    } catch {
      setErro("Não foi possível conectar ao servidor.");
    } finally {
      setAguarde(null);
    }
  }

  const plano = assinatura?.plano ?? sessao?.user?.plano ?? "free";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <Logo className="h-8 w-8 text-accent" />
        <span className="text-lg font-bold tracking-tight text-texto">Seu plano</span>
        <span
          className={`font-mono text-[10px] font-bold uppercase tracking-widest rounded-sm px-1.5 py-0.5 ${
            plano === "pro"
              ? "bg-accent/15 text-accent"
              : plano === "team"
                ? "bg-violeta/15 text-violeta"
                : "bg-borda/40 text-texto-2"
          }`}
        >
          {plano}
        </span>
      </div>

      {erro && (
        <p role="alert" className="mb-4 font-mono text-xs text-critica">{erro}</p>
      )}
      {ok && (
        <p role="status" className="mb-4 font-mono text-xs text-accent">{ok}</p>
      )}

      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Uso este mês</CardTitle>
            <CardDescription>Contadores do plano {plano.toUpperCase()}.</CardDescription>
          </CardHeader>
          <div className="flex flex-col gap-2 px-5 py-4 font-mono text-xs text-texto-2 sm:px-6">
            <p>
              relatórios: {uso ? `${uso.relatorios.usados}/${formatarLimite(uso.relatorios.limite)}` : "—"}
            </p>
            <p>
              retestes: {uso ? `${uso.retestes.usados}/${formatarLimite(uso.retestes.limite)}` : "—"}
            </p>
            {assinatura?.expiraEm && (
              <p>
                {assinatura.trial ? "trial até " : "ciclo até "}
                {assinatura.expiraEm.slice(0, 10)}
              </p>
            )}
          </div>
        </Card>

        {plano === "free" && (
          <Card>
            <CardHeader>
              <CardTitle>Testar o Pro</CardTitle>
              <CardDescription>
                30 dias grátis, sem cartão. Uma vez por conta.
              </CardDescription>
            </CardHeader>
            <div className="px-5 py-4 sm:px-6">
              <Button
                variante="primaria"
                onClick={testarPro}
                disabled={aguarde !== null}
              >
                {aguarde === "trial" ? (
                  <><Spinner /> ativando…</>
                ) : (
                  "ativar trial de 30 dias"
                )}
              </Button>
            </div>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Assinatura</CardTitle>
            <CardDescription>
              Pro R$ 19,90/mês · Team R$ 49,90/mês por usuário. Pagamentos via Asaas.
            </CardDescription>
          </CardHeader>
          <div className="flex flex-col gap-2.5 px-5 py-4 sm:flex-row sm:px-6">
            <Button
              variante="primaria"
              onClick={() => pagar("pro", "mensal")}
              disabled={aguarde !== null || plano !== "free"}
              className="sm:flex-1"
            >
              {aguarde?.startsWith("pagar-pro") ? "abrindo…" : "assinar pro"}
            </Button>
            <Button
              variante="secundaria"
              onClick={() => pagar("team", "mensal")}
              disabled={aguarde !== null || plano !== "free"}
              className="sm:flex-1"
            >
              {aguarde?.startsWith("pagar-team") ? "abrindo…" : "assinar team"}
            </Button>
            <Button
              variante="fantasma"
              onClick={abrirPortal}
              disabled={aguarde !== null || (!assinatura?.subscriptionId && plano === "free")}
            >
              {aguarde === "portal" ? "cancelando…" : "cancelar assinatura"}
            </Button>
          </div>
        </Card>

        <a
          href="/painel"
          className="self-start font-mono text-[11px] uppercase tracking-wider text-texto-2 hover:text-accent"
        >
          ← voltar ao painel
        </a>
      </div>
    </main>
  );
}

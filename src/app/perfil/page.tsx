"use client";

import { useCallback, useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/Card";
import { Spinner } from "@/components/Spinner";
import { Logo } from "@/components/Logo";
import { MarcaPdf } from "@/components/perfil/MarcaPdf";
import { PRECOS_CENTAVOS, formatarReais, type Periodo } from "@/lib/planos";

type Assinatura = {
  plano: "free" | "pro" | "team";
  expiraEm: string | null;
  subscriptionId: string | null;
  trial: boolean;
  status: string | null;
  temPortal: boolean;
};

type Uso = {
  relatorios: { usados: number; limite: number | null };
  retestes: { usados: number; limite: number | null };
  geracoes?: { usados: number; limite: number | null };
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

  const [seguranca, setSeguranca] = useState<{
    duasEtapas: boolean;
    emailVerificado: boolean;
    sessoesAbertas: number;
  } | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [a, u, s] = await Promise.all([
        fetch("/api/v1/assinatura").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/v1/uso").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/v1/auth/seguranca").then((r) => (r.ok ? r.json() : null)),
      ]);
      if (a) setAssinatura(a as Assinatura);
      if (u) setUso(u as Uso);
      if (s) setSeguranca(s);
    } catch {
      // silencioso: a página mostra estado vazio
    }
  }, []);

  async function sairDeTodos() {
    if (!window.confirm("Encerrar a sessão em todos os navegadores e apps, inclusive este?")) return;
    setAguarde("sessoes");
    try {
      await fetch("/api/v1/auth/logout?todos=1", { method: "POST" });
    } finally {
      await signOut({ callbackUrl: "/login" });
    }
  }

  useEffect(() => {
    void carregar();
    // Volta do checkout do Stripe: o webhook pode levar alguns segundos.
    if (new URLSearchParams(window.location.search).get("assinatura") === "ok") {
      setOk("Pagamento confirmado pelo Stripe. Seu plano é ativado em instantes.");
      const t = setTimeout(() => void carregar(), 4000);
      return () => clearTimeout(t);
    }
  }, [carregar]);

  const [periodo, setPeriodo] = useState<Periodo>("mensal");

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

  /** Portal do Stripe: cartão, faturas, troca de plano, cancelar/reativar. */
  async function abrirPortal() {
    setErro("");
    setAguarde("portal");
    try {
      const res = await fetch("/api/v1/assinatura/portal", { method: "POST" });
      const corpo = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !corpo?.url) {
        setErro(corpo?.error ?? "Portal indisponível no momento.");
        return;
      }
      window.location.href = corpo.url;
    } catch {
      setErro("Não foi possível conectar ao servidor.");
    } finally {
      setAguarde(null);
    }
  }

  async function cancelarRenovacao() {
    // Um clique só cancelava na hora: agora pede confirmação.
    if (!window.confirm("Cancelar a renovação da assinatura? Você continua com o plano até o fim do período já pago.")) {
      return;
    }
    setErro("");
    setAguarde("cancelar");
    try {
      const res = await fetch("/api/v1/assinatura/cancelar", { method: "POST" });
      const corpo = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        acessoAte?: string | null;
      } | null;
      if (!res.ok || !corpo?.ok) {
        setErro(corpo?.error ?? "Cancelamento indisponível no momento.");
        return;
      }
      setOk(
        corpo.acessoAte
          ? `Renovação cancelada. Seu plano continua até ${new Date(corpo.acessoAte).toLocaleDateString("pt-BR")}.`
          : "Assinatura cancelada. Você voltou para o Free.",
      );
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
            {uso?.geracoes && (
              <p>
                gerações com IA: {uso.geracoes.usados}/{formatarLimite(uso.geracoes.limite)}
              </p>
            )}
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
              Cartão de crédito pelo Stripe. Cancele quando quiser: o plano segue até o fim do período pago.
            </CardDescription>
          </CardHeader>

          {assinatura?.subscriptionId ? (
            <div className="flex flex-col gap-3 px-5 py-4 sm:px-6">
              <p className="font-mono text-xs text-texto-2">
                {assinatura.status === "past_due"
                  ? "⚠ o último pagamento falhou — atualize o cartão no portal"
                  : assinatura.status === "cancelada"
                    ? `renovação cancelada · acesso até ${assinatura.expiraEm ? new Date(assinatura.expiraEm).toLocaleDateString("pt-BR") : "o fim do período"}`
                    : `assinatura ativa · renova em ${assinatura.expiraEm ? new Date(assinatura.expiraEm).toLocaleDateString("pt-BR") : "—"}`}
              </p>
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <Button
                  variante="primaria"
                  onClick={abrirPortal}
                  disabled={aguarde !== null}
                  className="sm:flex-1"
                >
                  {aguarde === "portal" ? "abrindo…" : "gerenciar assinatura (cartão, faturas, plano)"}
                </Button>
                {assinatura.status !== "cancelada" && (
                  <Button variante="fantasma" onClick={cancelarRenovacao} disabled={aguarde !== null}>
                    {aguarde === "cancelar" ? "cancelando…" : "cancelar renovação"}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            // Quem está no trial (Pro sem assinatura) também pode assinar.
            <div className="flex flex-col gap-3 px-5 py-4 sm:px-6">
              <div
                role="radiogroup"
                aria-label="Período de cobrança"
                className="flex w-fit gap-1 rounded-lg border border-borda p-1 font-mono text-[11px] uppercase tracking-wider"
              >
                {(["mensal", "anual"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={periodo === p}
                    onClick={() => setPeriodo(p)}
                    className={`cursor-pointer rounded-md px-3 py-1.5 ${periodo === p ? "bg-accent/15 text-accent" : "text-texto-2 hover:text-texto"}`}
                  >
                    {p === "anual" ? "anual (−20%)" : "mensal"}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <Button
                  variante="primaria"
                  onClick={() => pagar("pro", periodo)}
                  disabled={aguarde !== null}
                  className="sm:flex-1"
                >
                  {aguarde?.startsWith("pagar-pro")
                    ? "abrindo…"
                    : `assinar pro · ${formatarReais(PRECOS_CENTAVOS.pro[periodo])}/${periodo === "anual" ? "ano" : "mês"}`}
                </Button>
                <Button
                  variante="secundaria"
                  onClick={() => pagar("team", periodo)}
                  disabled={aguarde !== null}
                  className="sm:flex-1"
                >
                  {aguarde?.startsWith("pagar-team")
                    ? "abrindo…"
                    : `assinar team · ${formatarReais(PRECOS_CENTAVOS.team[periodo])}/${periodo === "anual" ? "ano" : "mês"}`}
                </Button>
              </div>
              {assinatura?.temPortal && (
                <button
                  type="button"
                  onClick={abrirPortal}
                  className="w-fit cursor-pointer font-mono text-[11px] text-texto-2 hover:text-accent"
                >
                  ver faturas anteriores
                </button>
              )}
            </div>
          )}
        </Card>

        <MarcaPdf />

        <Card>
          <CardHeader>
            <CardTitle>Segurança</CardTitle>
            <CardDescription>Como sua conta está protegida.</CardDescription>
          </CardHeader>
          <div className="flex flex-col gap-3 px-5 py-4 sm:px-6">
            <ul className="flex flex-col gap-1.5 font-mono text-xs text-texto-2">
              <li>
                verificação em duas etapas:{" "}
                {seguranca ? (
                  seguranca.duasEtapas ? (
                    <span className="text-accent">ativa (senha + código por e-mail)</span>
                  ) : (
                    <span className="text-media">só senha (envio de e-mail ainda não configurado)</span>
                  )
                ) : (
                  "—"
                )}
              </li>
              <li>
                e-mail confirmado:{" "}
                {seguranca ? (seguranca.emailVerificado ? "sim" : "ainda não") : "—"}
              </li>
              <li>sessões abertas: {seguranca ? seguranca.sessoesAbertas : "—"}</li>
            </ul>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <a
                href="/esqueci-senha"
                className="inline-flex items-center justify-center rounded-lg border border-borda px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-texto-2 transition-colors hover:border-accent hover:text-accent"
              >
                trocar senha
              </a>
              <Button variante="fantasma" onClick={sairDeTodos} disabled={aguarde !== null}>
                {aguarde === "sessoes" ? "encerrando…" : "sair de todos os dispositivos"}
              </Button>
            </div>
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

"use client";

import { useSyncExternalStore } from "react";
import { signOut, useSession } from "next-auth/react";
import { Logo } from "@/components/Logo";
import { Tabs, type Aba } from "@/components/Tabs";

/** Estado real da conexão (antes o selo dizia "online" sempre — F18). */
function assinarConexao(aviso: () => void): () => void {
  window.addEventListener("online", aviso);
  window.addEventListener("offline", aviso);
  return () => {
    window.removeEventListener("online", aviso);
    window.removeEventListener("offline", aviso);
  };
}

function useOnline(): boolean {
  return useSyncExternalStore(
    assinarConexao,
    () => navigator.onLine,
    () => true,
  );
}

type Props = {
  aba: Aba;
  onAba: (aba: Aba) => void;
  contagem?: Partial<Record<Aba, number>>;
  pendentes?: number;
};

export function Header({ aba, onAba, contagem, pendentes }: Props) {
  const { data: sessao } = useSession();
  const plano = sessao?.user?.plano ?? "free";
  const online = useOnline();

  async function sair() {
    // Revoga a sessão no servidor e expira o cookie httpOnly (o signout do
    // NextAuth v5 sozinho não limpa a sessão JWT); depois sai no client.
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
    } catch {
      // segue o fluxo: o signOut limpa o estado local de qualquer jeito
    }
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <header className="no-print sticky top-0 z-30 border-b border-borda bg-fundo/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 sm:px-6">
        <div className="flex items-center gap-3">
          <Logo className="h-8 w-8 shrink-0 text-accent" />
          <span className="text-base font-bold tracking-tight text-texto">
            Provafix
          </span>
        </div>

        <div className="order-3 w-full sm:order-none sm:w-auto">
          <Tabs ativa={aba} onChange={onAba} contagem={contagem} />
        </div>

        <div className="ml-auto flex items-center gap-3">
          {typeof pendentes === "number" && pendentes > 0 && (
            <span className="hidden font-mono text-[10px] uppercase tracking-wider text-media sm:inline">
              {pendentes} pendente{pendentes === 1 ? "" : "s"}
            </span>
          )}
          {sessao?.user?.name && (
            <a
              href="/perfil"
              className="hidden max-w-32 truncate rounded-full border border-borda bg-superficie px-3 py-1 text-xs text-texto-2 transition-colors hover:border-accent hover:text-accent sm:inline"
              title={sessao.user.email ?? undefined}
            >
              {sessao.user.name}
            </a>
          )}
          {sessao && (
            <span
              aria-label={`Plano ${plano}`}
              title={
                plano === "free"
                  ? "Plano Free — ver planos em /precos"
                  : `Plano ${plano.toUpperCase()}`
              }
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
          )}
          {sessao && (
            <button
              type="button"
              onClick={sair}
              aria-label="Sair da conta"
              className="interativo cursor-pointer rounded-sm border border-borda px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-texto-2 hover:border-critica/50 hover:text-critica"
            >
              sair
            </button>
          )}
          <span
            role="status"
            className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-texto-2"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${online ? "animate-ping-suave bg-accent" : "bg-critica"}`}
            />
            {online ? "online" : "offline"}
          </span>
        </div>
      </div>
    </header>
  );
}

"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/Card";
import { Field, Input } from "@/components/Field";
import { Logo } from "@/components/Logo";
import { EtapaCodigo } from "@/components/auth/EtapaCodigo";
import { useEntrada } from "@/components/auth/useEntrada";

/**
 * /login — e-mail + senha e, com e-mail configurado no servidor, um código
 * de 6 dígitos enviado para a caixa do usuário (2ª etapa). Botão Google
 * aparece se o provedor estiver configurado.
 */
export default function PaginaLogin() {
  const roteador = useRouter();
  const entrada = useEntrada();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [temGoogle, setTemGoogle] = useState(false);

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((r) => (r.ok ? r.json() : {}))
      .then((p: Record<string, { id?: string }>) => {
        setTemGoogle(Object.values(p).some((x) => x && x.id === "google"));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (entrada.etapa === "concluido") {
      roteador.push("/painel");
      roteador.refresh();
    }
  }, [entrada.etapa, roteador]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    const r = await entrada.iniciar(email, senha);
    setEnviando(false);
    if (!r.ok) setErro(r.erro);
  }

  const naEtapaCodigo = entrada.etapa === "codigo";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <Logo className="h-9 w-9 text-accent" />
        <span className="text-xl font-bold tracking-tight text-texto">Provafix</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{naEtapaCodigo ? "Confirme que é você" : "Entrar"}</CardTitle>
          <CardDescription>
            {naEtapaCodigo
              ? "Verificação em duas etapas: senha + código no seu e-mail."
              : "Acesse sua conta para gerenciar relatórios."}
          </CardDescription>
        </CardHeader>

        {naEtapaCodigo ? (
          <EtapaCodigo
            destino={entrada.destino}
            reenvioEmSeg={entrada.reenvioEm}
            onConfirmar={entrada.confirmar}
            onReenviar={entrada.reenviar}
            onVoltar={() => {
              setSenha("");
              entrada.voltar();
            }}
          />
        ) : (
          <form onSubmit={entrar} className="flex flex-col gap-4 p-5 sm:p-6">
            <Field label="E-mail" htmlFor="login-email">
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                placeholder="voce@consultoria.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>

            <Field label="Senha" htmlFor="login-senha">
              <Input
                id="login-senha"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </Field>

            {erro && (
              <p role="alert" className="font-mono text-xs text-critica">
                {erro}
              </p>
            )}

            <Button variante="primaria" tamanho="lg" type="submit" disabled={enviando}>
              {enviando ? "conferindo…" : "entrar"}
            </Button>

            {temGoogle && (
              <Button
                variante="secundaria"
                tamanho="lg"
                type="button"
                onClick={() => signIn("google", { callbackUrl: "/painel" })}
              >
                entrar com Google
              </Button>
            )}

            <div className="flex items-center justify-between text-sm text-texto-2">
              <Link href="/esqueci-senha" className="hover:text-accent">
                esqueci minha senha
              </Link>
              <span>
                Sem conta?{" "}
                <Link href="/cadastro" className="text-accent hover:underline">
                  criar conta
                </Link>
              </span>
            </div>
          </form>
        )}
      </Card>
    </main>
  );
}

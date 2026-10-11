"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/Card";
import { Field, Input } from "@/components/Field";
import { Logo } from "@/components/Logo";

/** /login — e-mail + senha (Credentials) e botão Google (se configurado). */
export default function PaginaLogin() {
  const roteador = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [temGoogle, setTemGoogle] = useState(false);

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((r) => (r.ok ? r.json() : {}))
      .then((p: Record<string, { id?: string }>) => {
        setTemGoogle(
          Object.values(p).some((x) => x && x.id === "google"),
        );
      })
      .catch(() => {});
  }, []);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      const r = await signIn("credentials", {
        email: email.trim(),
        senha,
        redirect: false,
      });
      if (!r || r.error) {
        setErro("E-mail ou senha inválidos.");
        return;
      }
      roteador.push("/");
      roteador.refresh();
    } catch {
      setErro("Serviço de login indisponível. Tente de novo em instantes.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <Logo className="h-9 w-9 text-accent" />
        <span className="text-xl font-bold tracking-tight text-texto">Laudo</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entrar</CardTitle>
          <CardDescription>Acesse sua conta para gerenciar relatórios.</CardDescription>
        </CardHeader>

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
            {enviando ? "entrando…" : "entrar"}
          </Button>

          {temGoogle && (
            <Button
              variante="secundaria"
              tamanho="lg"
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/" })}
            >
              entrar com Google
            </Button>
          )}

          <p className="text-center text-sm text-texto-2">
            Sem conta?{" "}
            <Link href="/cadastro" className="text-accent hover:underline">
              criar conta
            </Link>
          </p>
        </form>
      </Card>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/Card";
import { Field, Input } from "@/components/Field";
import { Logo } from "@/components/Logo";
import { EtapaCodigo } from "@/components/auth/EtapaCodigo";
import { useEntrada } from "@/components/auth/useEntrada";

/** /cadastro — cria conta, confirma o e-mail (código) e já entra. */
export default function PaginaCadastro() {
  const roteador = useRouter();
  const entrada = useEntrada();

  useEffect(() => {
    if (entrada.etapa === "concluido") {
      roteador.push("/painel");
      roteador.refresh();
    }
  }, [entrada.etapa, roteador]);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      const res = await fetch("/api/v1/auth/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, senha }),
      });
      const corpo = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!res.ok) {
        setErro(corpo?.error ?? "Não foi possível criar a conta.");
        return;
      }

      // Mesmo fluxo do login: com e-mail ativo, o código que chega na
      // caixa confirma que o e-mail é mesmo de quem se cadastrou.
      const r = await entrada.iniciar(email, senha);
      if (!r.ok) {
        setErro("Conta criada. Faça login para continuar.");
        roteador.push("/login");
      }
    } catch {
      setErro("Não foi possível conectar ao servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <Logo className="h-9 w-9 text-accent" />
        <span className="text-xl font-bold tracking-tight text-texto">Provafix</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{entrada.etapa === "codigo" ? "Confirme seu e-mail" : "Criar conta"}</CardTitle>
          <CardDescription>
            {entrada.etapa === "codigo"
              ? "Conta criada. Falta só o código que mandamos para o seu e-mail."
              : "Comece a provar correções em minutos."}
          </CardDescription>
        </CardHeader>

        {entrada.etapa === "codigo" ? (
          <EtapaCodigo
            destino={entrada.destino}
            reenvioEmSeg={entrada.reenvioEm}
            onConfirmar={entrada.confirmar}
            onReenviar={entrada.reenviar}
            onVoltar={() => roteador.push("/login")}
            rotuloBotao="confirmar e entrar"
          />
        ) : (
        <form onSubmit={cadastrar} className="flex flex-col gap-4 p-5 sm:p-6">
          <Field label="Nome" htmlFor="cad-nome">
            <Input
              id="cad-nome"
              autoComplete="name"
              required
              maxLength={120}
              placeholder="Seu nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </Field>

          <Field label="E-mail" htmlFor="cad-email">
            <Input
              id="cad-email"
              type="email"
              autoComplete="email"
              required
              placeholder="voce@consultoria.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field label="Senha" htmlFor="cad-senha" dica="mínimo 8 caracteres; evite senhas óbvias">
            <Input
              id="cad-senha"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
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
            {enviando ? "criando…" : "criar conta"}
          </Button>

          <p className="text-center text-sm text-texto-2">
            Já tem conta?{" "}
            <Link href="/login" className="text-accent hover:underline">
              entrar
            </Link>
          </p>
        </form>
        )}
      </Card>
    </main>
  );
}

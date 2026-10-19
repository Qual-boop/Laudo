"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/Card";
import { Field, Input } from "@/components/Field";
import { Logo } from "@/components/Logo";

type Etapa = "email" | "codigo" | "pronto";

/**
 * /esqueci-senha — código por e-mail + senha nova. Trocar a senha derruba
 * todas as sessões abertas (quem entrou com a senha antiga perde o acesso).
 */
export default function PaginaEsqueciSenha() {
  const [etapa, setEtapa] = useState<Etapa>("email");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function postar(url: string, corpo: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const dados = (await res.json().catch(() => null)) as {
      error?: string;
      mensagem?: string;
    } | null;
    return { res, dados };
  }

  async function solicitar(e?: React.FormEvent) {
    e?.preventDefault();
    setErro("");
    setAviso("");
    setEnviando(true);
    try {
      const { res, dados } = await postar("/api/v1/auth/senha/solicitar", { email: email.trim() });
      if (res.status === 429) {
        setErro("Muitos pedidos. Aguarde alguns minutos e tente de novo.");
        return;
      }
      if (!res.ok) {
        setErro(dados?.error ?? "Não foi possível pedir o código agora.");
        return;
      }
      setAviso(dados?.mensagem ?? "Se houver uma conta com este e-mail, o código chega em instantes.");
      setEtapa("codigo");
    } catch {
      setErro("Não foi possível conectar ao servidor.");
    } finally {
      setEnviando(false);
    }
  }

  async function redefinir(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (senha !== senha2) {
      setErro("As duas senhas não são iguais.");
      return;
    }
    setEnviando(true);
    try {
      const { res, dados } = await postar("/api/v1/auth/senha/redefinir", {
        email: email.trim(),
        codigo,
        senha,
      });
      if (res.status === 429) {
        setErro("Muitas tentativas. Aguarde alguns minutos e tente de novo.");
        return;
      }
      if (!res.ok) {
        setErro(dados?.error ?? "Não foi possível trocar a senha.");
        return;
      }
      setEtapa("pronto");
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
          <CardTitle>{etapa === "pronto" ? "Senha trocada" : "Trocar a senha"}</CardTitle>
          <CardDescription>
            {etapa === "email" && "Mandamos um código para o e-mail da conta."}
            {etapa === "codigo" && "Digite o código recebido e a senha nova."}
            {etapa === "pronto" &&
              "Pronto. Por segurança, todas as sessões abertas foram encerradas — entre de novo com a senha nova."}
          </CardDescription>
        </CardHeader>

        {etapa === "email" && (
          <form onSubmit={solicitar} className="flex flex-col gap-4 p-5 sm:p-6">
            <Field label="E-mail da conta" htmlFor="rec-email">
              <Input
                id="rec-email"
                type="email"
                autoComplete="email"
                required
                placeholder="voce@consultoria.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            {erro && (
              <p role="alert" className="font-mono text-xs text-critica">
                {erro}
              </p>
            )}
            <Button variante="primaria" tamanho="lg" type="submit" disabled={enviando}>
              {enviando ? "enviando…" : "enviar código"}
            </Button>
            <Link href="/login" className="text-center text-sm text-texto-2 hover:text-accent">
              ← voltar para o login
            </Link>
          </form>
        )}

        {etapa === "codigo" && (
          <form onSubmit={redefinir} className="flex flex-col gap-4 p-5 sm:p-6">
            {aviso && (
              <p role="status" className="font-mono text-xs text-accent">
                {aviso}
              </p>
            )}
            <Field label="Código" htmlFor="rec-codigo">
              <Input
                id="rec-codigo"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                placeholder="000000"
                className="text-center font-mono text-2xl tracking-[0.5em]"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
              />
            </Field>
            <Field label="Senha nova" htmlFor="rec-senha" dica="mínimo 8 caracteres; evite senhas óbvias">
              <Input
                id="rec-senha"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </Field>
            <Field label="Repita a senha nova" htmlFor="rec-senha2">
              <Input
                id="rec-senha2"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={senha2}
                onChange={(e) => setSenha2(e.target.value)}
              />
            </Field>
            {erro && (
              <p role="alert" className="font-mono text-xs text-critica">
                {erro}
              </p>
            )}
            <Button
              variante="primaria"
              tamanho="lg"
              type="submit"
              disabled={enviando || codigo.length !== 6}
            >
              {enviando ? "trocando…" : "trocar a senha"}
            </Button>
            <button
              type="button"
              onClick={() => solicitar()}
              disabled={enviando}
              className="cursor-pointer text-sm text-texto-2 hover:text-accent"
            >
              não chegou? enviar outro código
            </button>
          </form>
        )}

        {etapa === "pronto" && (
          <div className="p-5 sm:p-6">
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-lg border border-accent bg-accent px-4 py-3 font-mono text-xs uppercase tracking-wider text-fundo"
            >
              ir para o login
            </Link>
          </div>
        )}
      </Card>
    </main>
  );
}

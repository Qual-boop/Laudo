"use client";

import { useCallback, useRef, useState } from "react";
import { signIn } from "next-auth/react";

/**
 * Login em duas etapas no navegador (usado por /login e /cadastro):
 *
 *   1. iniciar(email, senha) → /api/v1/auth/login/iniciar
 *      - servidor sem e-mail configurado → entra direto com a senha
 *      - com e-mail → código de 6 dígitos enviado; etapa "codigo"
 *   2. confirmar(codigo) → /login/confirmar devolve um ticket de uso
 *      único → signIn("credentials", { email, ticket }) cria a sessão
 *
 * A senha fica só na memória deste hook (ref) entre as duas etapas.
 */

export type Etapa = "credenciais" | "codigo" | "concluido";

type Resultado = { ok: true } | { ok: false; erro: string };

async function lerJson(res: Response): Promise<Record<string, unknown> | null> {
  return (await res.json().catch(() => null)) as Record<string, unknown> | null;
}

function mensagem(corpo: Record<string, unknown> | null, padrao: string): string {
  return typeof corpo?.error === "string" ? corpo.error : padrao;
}

export function useEntrada() {
  const [etapa, setEtapa] = useState<Etapa>("credenciais");
  const [destino, setDestino] = useState("");
  const [reenvioEm, setReenvioEm] = useState(0);
  const credenciais = useRef<{ email: string; senha: string } | null>(null);

  const iniciar = useCallback(async (email: string, senha: string): Promise<Resultado> => {
    credenciais.current = { email: email.trim(), senha };
    let res: Response;
    try {
      res = await fetch("/api/v1/auth/login/iniciar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), senha }),
      });
    } catch {
      return { ok: false, erro: "Não foi possível conectar ao servidor." };
    }
    const corpo = await lerJson(res);
    if (res.status === 429) {
      return { ok: false, erro: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
    }
    if (!res.ok) return { ok: false, erro: mensagem(corpo, "E-mail ou senha inválidos.") };

    if (corpo?.etapa === "senha") {
      // Servidor sem provedor de e-mail: entra só com a senha.
      const r = await signIn("credentials", { email: email.trim(), senha, redirect: false });
      if (!r || r.error) return { ok: false, erro: "E-mail ou senha inválidos." };
      setEtapa("concluido");
      return { ok: true };
    }

    setDestino(typeof corpo?.email === "string" ? corpo.email : "seu e-mail");
    setReenvioEm(typeof corpo?.reenvioEmSeg === "number" ? corpo.reenvioEmSeg : 45);
    setEtapa("codigo");
    return { ok: true };
  }, []);

  const confirmar = useCallback(async (codigo: string): Promise<Resultado> => {
    const c = credenciais.current;
    if (!c) {
      setEtapa("credenciais");
      return { ok: false, erro: "Digite e-mail e senha de novo." };
    }
    let res: Response;
    try {
      res = await fetch("/api/v1/auth/login/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...c, codigo }),
      });
    } catch {
      return { ok: false, erro: "Não foi possível conectar ao servidor." };
    }
    const corpo = await lerJson(res);
    if (res.status === 429) {
      return { ok: false, erro: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
    }
    if (!res.ok || typeof corpo?.ticket !== "string") {
      return { ok: false, erro: mensagem(corpo, "Código incorreto.") };
    }

    const r = await signIn("credentials", {
      email: c.email,
      ticket: corpo.ticket,
      redirect: false,
    });
    if (!r || r.error) return { ok: false, erro: "Código expirou. Peça um novo." };
    credenciais.current = null;
    setEtapa("concluido");
    return { ok: true };
  }, []);

  const reenviar = useCallback(async (): Promise<Resultado> => {
    const c = credenciais.current;
    if (!c) {
      setEtapa("credenciais");
      return { ok: false, erro: "Digite e-mail e senha de novo." };
    }
    return iniciar(c.email, c.senha);
  }, [iniciar]);

  const voltar = useCallback(() => {
    credenciais.current = null;
    setEtapa("credenciais");
  }, []);

  return { etapa, destino, reenvioEm, iniciar, confirmar, reenviar, voltar };
}

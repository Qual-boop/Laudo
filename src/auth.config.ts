import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { esquemaLogin } from "@/lib/validacao";

/**
 * Configuração do NextAuth v5 (sessão JWT — o mesmo token serve web,
 * mobile e desktop).
 *
 * Edge-safe de propósito: este módulo NÃO importa @/lib/db nem bcrypt
 * estaticamente, porque o middleware (Edge runtime) o carrega. Todo
 * acesso ao banco acontece via `await import("@/lib/usuarios")` dentro
 * dos callbacks — que só executam no Node.
 */
export const authConfig: NextAuthConfig = {
  // O host vem do request (dev, túnel Cloudflare, produção atrás de proxy).
  // Sem confiar no host, toda rota /api/auth/* devolve 500 UntrustedHost em
  // produção e o login trava (foi o bug: cadastro ok, login impossível).
  // Em produção, defina AUTH_URL com o domínio final (ver .env.example).
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        senha: { label: "Senha", type: "password" },
      },
      authorize: async (credentials) => {
        const v = esquemaLogin.safeParse(credentials);
        if (!v.success) return null;
        const { buscarUsuarioPorEmail, compararSenha } = await import(
          "@/lib/usuarios"
        );
        const u = await buscarUsuarioPorEmail(v.data.email);
        if (!u?.senha_hash) return null;
        if (!(await compararSenha(v.data.senha, u.senha_hash))) return null;
        // O limite de tentativas fica no route handler (precisa responder
        // 429); aqui só liberamos o contador do e-mail no login certo.
        (await import("@/lib/limite-taxa")).liberarEmailLogin(v.data.email);
        return { id: String(u.id), name: u.nome, email: u.email };
      },
    }),
    // Google só aparece se as credenciais OAuth estiverem configuradas.
    ...(process.env.GOOGLE_CLIENT_ID ? [Google] : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Login Google precisa de uma linha em `usuarios` (multi-tenant).
      if (account?.provider === "google" && user.email) {
        const { buscarOuCriarPorEmail } = await import("@/lib/usuarios");
        const u = await buscarOuCriarPorEmail(user.email, user.name ?? user.email);
        if (!u) return false;
        user.id = String(u.id);
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        const { buscarUsuarioPorId } = await import("@/lib/usuarios");
        const { assinaturaDe } = await import("@/lib/assinatura");
        const u = await buscarUsuarioPorId(Number(user.id));
        if (u) {
          token.usuarioId = u.id;
          token.name = u.nome;
          token.email = u.email;
          token.plano = (await assinaturaDe(u)).plano;
        }
      }
      // Sessões que só têm `sub`: resolve o usuarioId na hora.
      if (token.usuarioId === undefined && token.sub) {
        const { buscarUsuarioPorId } = await import("@/lib/usuarios");
        const { assinaturaDe } = await import("@/lib/assinatura");
        const u = await buscarUsuarioPorId(Number(token.sub));
        if (u) {
          token.usuarioId = u.id;
          token.name = u.nome;
          token.email = u.email;
          token.plano = (await assinaturaDe(u)).plano;
        }
      }
      return token;
    },
    async session({ session, token }) {
      const t = token as unknown as Record<string, unknown>;
      if (session.user) {
        session.user.id = String(
          (t.usuarioId as number | undefined) ?? token.sub ?? "",
        );
        session.user.name = (t.name as string | undefined) ?? session.user.name;
        session.user.email =
          (t.email as string | undefined) ?? session.user.email;
        session.user.plano =
          (t.plano as "free" | "pro" | "team" | undefined) ?? "free";
      }
      return session;
    },
  },
};

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string; plano: "free" | "pro" | "team" } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    usuarioId?: number;
    plano?: "free" | "pro" | "team";
  }
}

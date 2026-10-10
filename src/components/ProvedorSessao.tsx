"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

/** Expõe useSession/signIn/signOut para o app (Header, /login, /cadastro). */
export function ProvedorSessao({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}

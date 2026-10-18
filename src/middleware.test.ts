import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

function abrir(caminho: string) {
  return middleware(new NextRequest(`http://localhost${caminho}`));
}

describe("middleware", () => {
  it("link público do certificado abre sem sessão", async () => {
    const token = "A".repeat(43);
    for (const caminho of [`/c/${token}`, `/c/${token}/json`]) {
      const res = await abrir(caminho);
      expect(res.headers.get("x-middleware-next")).toBe("1");
      expect(res.headers.get("location")).toBeNull();
    }
  });

  it("certificado do dono e painel continuam exigindo login", async () => {
    for (const caminho of ["/certificado/1", "/painel", "/cadastrox"]) {
      const res = await abrir(caminho);
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    }
  });
});

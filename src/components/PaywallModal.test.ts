import { describe, expect, it } from "vitest";
import { podeExibir } from "@/components/PaywallModal";

describe("podeExibir (throttle do paywall)", () => {
  it("exibe na primeira vez", () => {
    expect(podeExibir(null)).toBe(true);
  });

  it("não exibe 2x no mesmo dia", () => {
    const agora = Date.now();
    expect(podeExibir(agora - 3600_000, agora)).toBe(false);
  });

  it("volta a exibir após 24h", () => {
    const agora = Date.now();
    expect(podeExibir(agora - 25 * 3600_000, agora)).toBe(true);
  });
});

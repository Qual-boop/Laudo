import { ImageResponse } from "next/og";

/* Imagem de compartilhamento (WhatsApp, LinkedIn, X...). Gerada no build. */

export const alt = "Provafix — Prove que as correções funcionaram";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACCENT = "#00ff88";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background:
            "radial-gradient(900px 500px at 85% -10%, rgba(0,255,136,0.16), transparent 70%), #0a0e14",
          color: "#e5e7eb",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* Mesmo monograma P✓ de components/Logo.tsx. */}
          <svg width="60" height="60" viewBox="0 0 48 48" fill="none">
            <rect x="3" y="3" width="42" height="42" rx="13" fill={ACCENT} />
            <path
              d="M16.5 35.5 V12.5 H25 A7.25 7.25 0 0 1 25 27 H22 L27 32 L38.5 18.5"
              stroke="#0a0e14"
              strokeWidth="4.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>Provafix</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: -3, lineHeight: 1.02 }}>
            Prove que as correções
          </div>
          <div
            style={{
              fontSize: 84,
              fontWeight: 700,
              letterSpacing: -3,
              lineHeight: 1.1,
              color: ACCENT,
            }}
          >
            funcionaram.
          </div>
          <div style={{ marginTop: 28, fontSize: 32, color: "#9ca3af" }}>
            Relatório de pentest · reteste · certificado de correção
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 28,
            fontSize: 22,
            color: "#9ca3af",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          <span>CVSS v3.1</span>
          <span>OWASP</span>
          <span>SHA-256</span>
          <span>Jira · GitHub</span>
          <span style={{ color: ACCENT }}>Grátis para começar</span>
        </div>
      </div>
    ),
    size,
  );
}

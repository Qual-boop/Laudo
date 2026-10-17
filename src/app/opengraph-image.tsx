import { ImageResponse } from "next/og";

/* Imagem de compartilhamento (WhatsApp, LinkedIn, X...). Gerada no build. */

export const alt = "Laudo — Prove que as correções funcionaram";
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
          <svg width="56" height="56" viewBox="0 0 48 48" fill="none">
            <path
              d="M37.5 20.4 A14 14 0 1 1 32 12.5"
              stroke={ACCENT}
              strokeOpacity="0.45"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
            <path
              d="M19 27.5 L26 34 L38 18"
              stroke={ACCENT}
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>Laudo</span>
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

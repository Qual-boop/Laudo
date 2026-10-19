import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { ProvedorSessao } from "@/components/ProvedorSessao";
import { URL_SITE, VERIFICACAO_GOOGLE } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

/* Serifa só para destaques (landing e certificado) — o resto é Geist. */
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0a0e14",
  width: "device-width",
  initialScale: 1,
};

const TITULO = "Provafix — Relatório de pentest, reteste e certificado de correção";
const DESCRICAO =
  "Gere o relatório de pentest com IA, registre o reteste com evidência e entregue ao cliente um certificado de correção com hash SHA-256. Em português, grátis para começar.";

export const metadata: Metadata = {
  metadataBase: new URL(URL_SITE),
  title: {
    default: TITULO,
    template: "%s | Provafix",
  },
  description: DESCRICAO,
  applicationName: "Provafix",
  ...(VERIFICACAO_GOOGLE ? { verification: { google: VERIFICACAO_GOOGLE } } : {}),
  keywords: [
    "Provafix",
    "relatório de pentest",
    "teste de intrusão",
    "reteste de vulnerabilidades",
    "certificado de correção",
    "assurance de segurança",
    "CVSS",
    "OWASP",
    "pentest freelancer",
  ],
  authors: [{ name: "Provafix" }],
  creator: "Provafix",
  publisher: "Provafix",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  // Imagem: app/opengraph-image.tsx (convenção de arquivo do Next).
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: "Provafix",
    title: TITULO,
    description: DESCRICAO,
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: DESCRICAO,
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/favicon.ico",
    // iOS não usa SVG como ícone da tela inicial: PNG 180×180.
    apple: "/apple-icon.png",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <ProvedorSessao>{children}</ProvedorSessao>
      </body>
    </html>
  );
}

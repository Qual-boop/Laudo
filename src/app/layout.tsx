import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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

export const viewport: Viewport = {
  themeColor: "#0f0f0f",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://laudo.app"),
  title: {
    default: "Laudo — Relatórios de pentest em segundos",
    template: "%s | Laudo",
  },
  description:
    "Gere visões executiva, técnica e de ticket a partir de um achado de pentest, com IA. Certificados de correção, exportação Jira/GitHub e verificação de retestes.",
  keywords: [
    "pentest",
    "relatório de segurança",
    "teste de intrusão",
    "vulnerabilidade",
    "certificado de correção",
    "Jira",
    "GitHub",
  ],
  authors: [{ name: "Laudo" }],
  creator: "Laudo",
  publisher: "Laudo",
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
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "https://laudo.app",
    siteName: "Laudo",
    title: "Laudo — Relatórios de pentest em segundos",
    description:
      "Gere relatórios profissionais de teste de intrusão com IA. Certificados de correção, verificação de retestes e exportação para Jira/GitHub.",
    images: [
      {
        url: "/icon.svg",
        width: 512,
        height: 512,
        alt: "Laudo - Relatórios de pentest",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Laudo — Relatórios de pentest em segundos",
    description:
      "Gere relatórios profissionais de teste de intrusão com IA. Certificados de correção e exportação para Jira/GitHub.",
    images: ["/icon.svg"],
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/favicon.ico",
    apple: "/icon.svg",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}

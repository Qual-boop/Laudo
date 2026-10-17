import type { ReactNode } from "react";
import { Icone } from "@/components/landing/Icone";

/* Mini-telas ilustrativas de cada passo do "Como funciona". Puramente
   decorativas: o texto do passo ao lado carrega a informação. */

function Moldura({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div aria-hidden="true" className="lp-painel overflow-hidden rounded-xl">
      <div className="border-b border-white/[0.06] px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-texto-2">
        {titulo}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

function Chip({ children, cor = "text-texto-2 border-white/10" }: { children: ReactNode; cor?: string }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[10px] ${cor}`}>
      {children}
    </span>
  );
}

export function VinhetaCadastro() {
  return (
    <Moldura titulo="novo engagement">
      <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="font-mono text-[11px] text-texto-2">cliente</dt>
        <dd className="text-texto">Acme Pagamentos Ltda.</dd>
        <dt className="font-mono text-[11px] text-texto-2">escopo</dt>
        <dd className="text-texto">portal.acme.com.br · API v2</dd>
        <dt className="font-mono text-[11px] text-texto-2">período</dt>
        <dd className="font-mono text-[13px] text-texto">02/10 – 06/10</dd>
      </dl>
      <div className="mt-4 rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
        <p className="text-sm text-texto">IDOR no endpoint de faturas</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Chip cor="border-alta/40 text-alta">Alta</Chip>
          <Chip>CWE-639</Chip>
          <Chip>confiança alta</Chip>
          <Chip>evidência anexada</Chip>
        </div>
      </div>
    </Moldura>
  );
}

const SECOES = [
  "Capa",
  "Sumário executivo",
  "Escopo",
  "Achados",
  "Recomendações",
  "Conclusão",
  "Disclaimer",
];

export function VinhetaRelatorio() {
  return (
    <Moldura titulo="relatório · gerado com ia">
      <ol className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        {SECOES.map((s, i) => (
          <li key={s} className={`flex items-center gap-2 ${i === 3 ? "text-texto" : "text-texto-2"}`}>
            <span className="font-mono text-[10px] text-texto-2/70">{i + 1}</span>
            {s}
            <Icone nome="check" className="ml-auto h-3.5 w-3.5 text-accent/80" />
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
        <Chip cor="border-alta/40 text-alta">CVSS 8.1</Chip>
        <Chip>OWASP A01:2021</Chip>
        <Chip>CWE-639</Chip>
        <span className="mt-1 block w-full truncate font-mono text-[10px] text-texto-2">
          AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N
        </span>
      </div>
    </Moldura>
  );
}

export function VinhetaReteste() {
  return (
    <Moldura titulo="finding-002 · histórico de reteste">
      <ol className="relative flex flex-col gap-4 border-l border-white/10 pl-5">
        <li className="relative">
          <span className="absolute -left-[1.6rem] top-1 h-2.5 w-2.5 rounded-full bg-critica" />
          <p className="font-mono text-[11px] text-texto-2">09/10 · não corrigido</p>
          <p className="mt-0.5 text-sm text-texto">Usuário B ainda lê /faturas/1043</p>
        </li>
        <li className="relative">
          <span className="absolute -left-[1.6rem] top-1 h-2.5 w-2.5 rounded-full bg-accent" />
          <p className="font-mono text-[11px] text-accent">14/10 · corrigido</p>
          <p className="mt-0.5 text-sm text-texto">HTTP 403 para fatura de outro usuário</p>
          <div className="mt-2">
            <Chip>reteste-faturas-403.png</Chip>
          </div>
        </li>
      </ol>
    </Moldura>
  );
}

export function VinhetaDelta() {
  return (
    <Moldura titulo="delta · antes vs depois">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-texto-2">antes</p>
          <p className="mt-1 text-3xl font-semibold text-texto">3</p>
          <p className="text-xs text-texto-2">abertos</p>
          <p className="mt-2 flex justify-center gap-1">
            <span className="h-1.5 w-4 rounded-full bg-critica" />
            <span className="h-1.5 w-4 rounded-full bg-alta" />
            <span className="h-1.5 w-4 rounded-full bg-media" />
          </p>
        </div>
        <Icone nome="seta" className="h-5 w-5 text-texto-2" />
        <div className="rounded-lg border border-accent/30 bg-accent/[0.06] p-3 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">depois</p>
          <p className="mt-1 text-3xl font-semibold text-accent">0</p>
          <p className="text-xs text-texto-2">abertos</p>
          <p className="mt-2 flex justify-center gap-1">
            <span className="h-1.5 w-4 rounded-full bg-accent" />
            <span className="h-1.5 w-4 rounded-full bg-accent" />
            <span className="h-1.5 w-4 rounded-full bg-accent" />
          </p>
        </div>
      </div>
      <p className="mt-4 flex items-center gap-2 text-sm text-texto">
        <Icone nome="hash" className="h-4 w-4 text-accent" />
        Certificado liberado para emissão
      </p>
    </Moldura>
  );
}

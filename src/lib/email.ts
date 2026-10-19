/**
 * Envio de e-mail transacional por API HTTPS (fetch puro, sem SDK).
 *
 * Por que HTTPS e não SMTP: o Railway bloqueia SMTP de saída fora do plano
 * Pro. Dois provedores, escolhidos pela chave presente no ambiente:
 *
 *   BREVO_API_KEY  → api.brevo.com  (grátis: 300/dia; aceita remetente
 *                    verificado sem domínio próprio — ex.: um Gmail)
 *   RESEND_API_KEY → api.resend.com (grátis: 3.000/mês; exige domínio
 *                    próprio verificado para mandar a terceiros)
 *
 * EMAIL_REMETENTE é o endereço "de" (verificado no provedor) e
 * EMAIL_REMETENTE_NOME o nome exibido (padrão "Provafix").
 * Sem chave ou sem remetente, `emailAtivo()` é false e o login segue só
 * com senha — o app nunca trava por falta de provedor.
 */

export type Mensagem = {
  para: string;
  assunto: string;
  texto: string;
  html: string;
};

function remetente(): { email: string; nome: string } | null {
  const email = process.env.EMAIL_REMETENTE?.trim();
  if (!email) return null;
  return { email, nome: process.env.EMAIL_REMETENTE_NOME?.trim() || "Provafix" };
}

export function provedorEmail(): "brevo" | "resend" | null {
  if (process.env.BREVO_API_KEY?.trim()) return "brevo";
  if (process.env.RESEND_API_KEY?.trim()) return "resend";
  return null;
}

/** Há provedor e remetente configurados: os fluxos com código ligam. */
export function emailAtivo(): boolean {
  return provedorEmail() !== null && remetente() !== null;
}

export class ErroEmail extends Error {}

export async function enviarEmail(m: Mensagem): Promise<void> {
  const de = remetente();
  const provedor = provedorEmail();
  if (!de || !provedor) throw new ErroEmail("E-mail não configurado no servidor.");

  const res =
    provedor === "brevo"
      ? await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": process.env.BREVO_API_KEY!.trim(),
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            sender: { name: de.nome, email: de.email },
            to: [{ email: m.para }],
            subject: m.assunto,
            textContent: m.texto,
            htmlContent: m.html,
          }),
          signal: AbortSignal.timeout(15_000),
        })
      : await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${de.nome} <${de.email}>`,
            to: [m.para],
            subject: m.assunto,
            text: m.texto,
            html: m.html,
          }),
          signal: AbortSignal.timeout(15_000),
        });

  if (!res.ok) {
    // Só o status no log: o corpo do provedor pode ecoar o destinatário.
    console.error(JSON.stringify({ email: provedor, status: res.status }));
    throw new ErroEmail(`Falha no envio (${provedor} HTTP ${res.status}).`);
  }
}

/** "elias@gmail.com" → "el***@gmail.com" (mostrar sem expor o endereço inteiro). */
export function mascararEmail(email: string): string {
  const [usuario, dominio] = email.split("@");
  if (!dominio) return "***";
  return `${usuario.slice(0, 2)}***@${dominio}`;
}

function escapar(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const FINALIDADE_TEXTO = {
  login: {
    assunto: "Seu código de acesso ao Provafix",
    chamada: "Use este código para entrar na sua conta:",
    aviso: "Se não foi você, ignore este e-mail e troque sua senha — alguém sabe a senha atual.",
  },
  senha: {
    assunto: "Código para trocar a senha do Provafix",
    chamada: "Use este código para criar uma nova senha:",
    aviso: "Se você não pediu a troca, ignore este e-mail. Sua senha atual continua valendo.",
  },
} as const;

/** E-mail do código (texto + HTML simples, legível em qualquer cliente). */
export function mensagemCodigo(
  para: string,
  nome: string,
  codigo: string,
  finalidade: keyof typeof FINALIDADE_TEXTO,
  validadeMin: number,
): Mensagem {
  const t = FINALIDADE_TEXTO[finalidade];
  const primeiroNome = nome.trim().split(/\s+/)[0] || "olá";
  const texto = [
    `Olá, ${primeiroNome}.`,
    "",
    t.chamada,
    "",
    `    ${codigo}`,
    "",
    `Ele vale por ${validadeMin} minutos e só funciona uma vez.`,
    t.aviso,
    "",
    "— Provafix",
  ].join("\n");
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1b2430">
<div style="max-width:440px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;border:1px solid #e3e8ee">
<p style="margin:0 0 4px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#0f9d74;font-weight:bold">Provafix</p>
<p style="margin:16px 0 8px;font-size:15px">Olá, ${escapar(primeiroNome)}.</p>
<p style="margin:0 0 16px;font-size:15px">${t.chamada}</p>
<p style="margin:0 0 16px;font-size:34px;letter-spacing:10px;font-weight:bold;font-family:'Courier New',monospace;color:#0b1520">${codigo}</p>
<p style="margin:0 0 6px;font-size:13px;color:#56637a">Ele vale por ${validadeMin} minutos e só funciona uma vez.</p>
<p style="margin:0;font-size:13px;color:#56637a">${t.aviso}</p>
</div></body></html>`;
  return { para, assunto: t.assunto, texto, html };
}

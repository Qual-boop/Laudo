/**
 * Escudo de privacidade.
 *
 * Antes de qualquer chamada de IA, troca dados sensíveis do cliente por
 * marcadores ([[IP-1]], [[HOST-2]], [[CLIENTE-1]]…) e, quando o relatório
 * volta, devolve os valores reais. O provedor de IA nunca recebe o dado
 * original. A tabela de troca vive só na memória desta requisição — não
 * vai para log, banco nem resposta.
 *
 * Princípio: na dúvida, mascarar. Um marcador a mais custa um pouco de
 * contexto para a IA; um dado vazado não tem volta.
 */

export type TipoSensivel =
  | "CLIENTE"
  | "SEGREDO"
  | "TOKEN"
  | "EMAIL"
  | "CPF"
  | "CNPJ"
  | "CARTAO"
  | "IP"
  | "HOST";

export const ROTULO_TIPO: Record<TipoSensivel, string> = {
  CLIENTE: "nome do cliente",
  SEGREDO: "senhas e chaves",
  TOKEN: "tokens e cookies",
  EMAIL: "e-mails",
  CPF: "CPFs",
  CNPJ: "CNPJs",
  CARTAO: "cartões",
  IP: "endereços IP",
  HOST: "domínios e hosts",
};

const TIPOS = Object.keys(ROTULO_TIPO) as TipoSensivel[];

/** Campos que nunca carregam dado do cliente (enums, datas, CWE). */
const CAMPOS_INTOCADOS = new Set([
  "severidade",
  "confianca",
  "dataRetesteSugerida",
  "cwe",
]);

/* Domínios de referência pública: citá-los não expõe o cliente. */
const DOMINIOS_PUBLICOS = [
  "owasp.org",
  "mitre.org",
  "nist.gov",
  "first.org",
  "cisa.gov",
  "portswigger.net",
  "tenable.com",
  "zaproxy.org",
  "mozilla.org",
  "microsoft.com",
  "google.com",
  "github.com",
  "gitlab.com",
  "cloudflare.com",
  "apache.org",
  "nginx.org",
  "php.net",
  "python.org",
  "nodejs.org",
  "npmjs.com",
  "w3.org",
  "ietf.org",
  "rfc-editor.org",
  "letsencrypt.org",
  "exploit-db.com",
  "snyk.io",
  "wikipedia.org",
  "ssllabs.com",
  "pcisecuritystandards.org",
];

const TLDS =
  "com|net|org|br|io|app|dev|cloud|gov|edu|mil|info|biz|co|me|tech|online|site|store|xyz|ai|us|uk|de|fr|es|pt|ar|cl|mx|local|internal|intranet|corp|lan|home|test";

const RE_PEM =
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g;
const RE_JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
const RE_CHAVES_CONHECIDAS = new RegExp(
  [
    "\\bAKIA[0-9A-Z]{16}\\b", // AWS
    "\\bgh[pousr]_[A-Za-z0-9]{30,}\\b", // GitHub clássico
    "\\bgithub_pat_[A-Za-z0-9_]{30,}\\b", // GitHub fine-grained
    "\\bsk-[A-Za-z0-9_-]{20,}\\b", // OpenAI e afins
    "\\bxox[abprs]-[A-Za-z0-9-]{10,}\\b", // Slack
    "\\bAIza[0-9A-Za-z_-]{35}\\b", // Google API
    "\\b\\$aact_[A-Za-z0-9_]{20,}", // Asaas
    "\\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\\b", // Stripe
    "\\bwhsec_[A-Za-z0-9]{16,}\\b", // Stripe (webhook)
    "\\bxkeysib-[A-Za-z0-9-]{20,}\\b", // Brevo
  ].join("|"),
  "g",
);
const RE_AUTORIZACAO = /(authorization\s*:\s*(?:bearer|basic|token|digest)\s+)([^\s"'<>]+)/gi;
const RE_COOKIE = /((?:set-)?cookie\s*:\s*)([^\r\n]+)/gi;
const RE_PAR_COOKIE = /([^=;\s]+)=([^;\r\n]+)/g;
const RE_CHAVE_VALOR =
  /\b(password|passwd|pwd|senha|secret|segredo|token|api[_-]?key|apikey|access[_-]?key|client[_-]?secret|private[_-]?key)(["']?\s*[:=]\s*["']?)([^\s"'&,;<>]{3,})/gi;
const RE_EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const RE_CNPJ = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g;
const RE_CPF = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g;
const RE_CARTAO = /\b[3-6]\d{3}(?:[ -]?\d{4}){2}[ -]?\d{1,7}\b/g;
const RE_IPV4 =
  /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g;
const RE_HOST = new RegExp(
  `\\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+(?:${TLDS})\\b(?![.-]?[a-z0-9])`,
  "gi",
);
const RE_MARCADOR = /\[\[\s*([A-Z]+)-(\d+)\s*\]\]|\[([A-Z]+)-(\d+)\]/g;

const IPS_NEUTROS = new Set(["0.0.0.0", "127.0.0.1", "255.255.255.255"]);
const SUFIXOS_EMPRESA = /[\s,]+(ltda\.?|s\.?\/?a\.?|me|epp|eireli|inc\.?|llc|ltd\.?)$/i;

function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function passaLuhn(digitos: string): boolean {
  let soma = 0;
  let dobrar = false;
  for (let i = digitos.length - 1; i >= 0; i--) {
    let d = Number(digitos[i]);
    if (dobrar) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    soma += d;
    dobrar = !dobrar;
  }
  return soma % 10 === 0;
}

function dominioPublico(host: string): boolean {
  const h = host.toLowerCase();
  return DOMINIOS_PUBLICOS.some((d) => h === d || h.endsWith(`.${d}`));
}

/** Aplica `f` a toda string de um objeto/array, exceto campos intocados. */
function mapearTextos<T>(valor: T, f: (s: string) => string, chave?: string): T {
  if (typeof valor === "string") {
    return (chave && CAMPOS_INTOCADOS.has(chave) ? valor : f(valor)) as T;
  }
  if (Array.isArray(valor)) {
    return valor.map((v) => mapearTextos(v, f)) as T;
  }
  if (valor !== null && typeof valor === "object") {
    const saida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      saida[k] = mapearTextos(v, f, k);
    }
    return saida as T;
  }
  return valor;
}

export class EscudoPrivacidade {
  private readonly marcadorDe = new Map<string, string>();
  private readonly valorDe = new Map<string, string>();
  private readonly contagem = new Map<TipoSensivel, number>();
  private readonly reCliente: RegExp | null;

  /** @param nomesCliente nome(s) do cliente a mascarar onde aparecerem. */
  constructor(nomesCliente: string[] = []) {
    const variantes = new Set<string>();
    for (const bruto of nomesCliente) {
      const nome = bruto.trim();
      if (nome.length < 3) continue;
      variantes.add(nome);
      const semSufixo = nome.replace(SUFIXOS_EMPRESA, "").trim();
      if (semSufixo.length >= 4) variantes.add(semSufixo);
    }
    // Maior primeiro: "Acme Pagamentos Ltda." vence "Acme Pagamentos".
    const ordenadas = [...variantes].sort((a, b) => b.length - a.length);
    this.reCliente = ordenadas.length
      ? new RegExp(ordenadas.map(escaparRegex).join("|"), "gi")
      : null;
  }

  private marcar(tipo: TipoSensivel, valor: string): string {
    const chave = `${tipo}\u0000${valor.toLowerCase()}`;
    const existente = this.marcadorDe.get(chave);
    if (existente) return existente;
    const n = (this.contagem.get(tipo) ?? 0) + 1;
    this.contagem.set(tipo, n);
    const marcador = `[[${tipo}-${n}]]`;
    this.marcadorDe.set(chave, marcador);
    this.valorDe.set(`${tipo}-${n}`, valor);
    return marcador;
  }

  /** Mascara um texto livre. Idempotente sobre marcadores já aplicados. */
  anonimizarTexto(texto: string): string {
    if (!texto) return texto;
    let t = texto;

    if (this.reCliente) t = t.replace(this.reCliente, (m) => this.marcar("CLIENTE", m));
    t = t.replace(RE_PEM, (m) => this.marcar("SEGREDO", m));
    t = t.replace(RE_JWT, (m) => this.marcar("TOKEN", m));
    t = t.replace(RE_CHAVES_CONHECIDAS, (m) => this.marcar("SEGREDO", m));
    t = t.replace(RE_AUTORIZACAO, (_m, prefixo: string, valor: string) =>
      valor.startsWith("[[") ? `${prefixo}${valor}` : `${prefixo}${this.marcar("TOKEN", valor)}`,
    );
    t = t.replace(RE_COOKIE, (_m, prefixo: string, pares: string) =>
      prefixo +
      pares.replace(RE_PAR_COOKIE, (par, nome: string, valor: string) =>
        valor.trim().startsWith("[[") ? par : `${nome}=${this.marcar("TOKEN", valor.trim())}`,
      ),
    );
    t = t.replace(RE_CHAVE_VALOR, (m, nome: string, sep: string, valor: string) =>
      valor.startsWith("[[") ? m : `${nome}${sep}${this.marcar("SEGREDO", valor)}`,
    );
    t = t.replace(RE_EMAIL, (m) => this.marcar("EMAIL", m));
    t = t.replace(RE_CNPJ, (m) => this.marcar("CNPJ", m));
    t = t.replace(RE_CPF, (m) => this.marcar("CPF", m));
    t = t.replace(RE_CARTAO, (m) => {
      const digitos = m.replace(/\D/g, "");
      return digitos.length >= 13 && digitos.length <= 19 && passaLuhn(digitos)
        ? this.marcar("CARTAO", m)
        : m;
    });
    t = t.replace(RE_IPV4, (m) => (IPS_NEUTROS.has(m) ? m : this.marcar("IP", m)));
    t = t.replace(RE_HOST, (m) => (dominioPublico(m) ? m : this.marcar("HOST", m)));
    return t;
  }

  /** Devolve os valores reais no lugar dos marcadores (tolerante a espaços). */
  restaurarTexto(texto: string): string {
    if (!texto || !texto.includes("[")) return texto;
    return texto.replace(RE_MARCADOR, (m, t1?: string, n1?: string, t2?: string, n2?: string) => {
      const chave = `${t1 ?? t2}-${n1 ?? n2}`;
      return this.valorDe.get(chave) ?? m;
    });
  }

  /** Mascara todas as strings de um objeto (entrada da geração). */
  anonimizar<T>(dados: T): T {
    return mapearTextos(dados, (s) => this.anonimizarTexto(s));
  }

  /** Restaura todas as strings de um objeto (relatório devolvido pela IA). */
  restaurar<T>(dados: T): T {
    return mapearTextos(dados, (s) => this.restaurarTexto(s));
  }

  /** Quantos valores distintos de cada tipo foram protegidos. */
  resumo(): { tipo: TipoSensivel; quantidade: number }[] {
    return TIPOS.filter((t) => this.contagem.has(t)).map((tipo) => ({
      tipo,
      quantidade: this.contagem.get(tipo) ?? 0,
    }));
  }

  /** Resumo em ASCII para cabeçalho HTTP: "IP=2;HOST=3". */
  cabecalho(): string {
    return this.resumo()
      .map((r) => `${r.tipo}=${r.quantidade}`)
      .join(";");
  }
}

/** Lê o cabeçalho de volta (lado do cliente). */
export function lerResumoProtecao(
  valor: string | null,
): { tipo: TipoSensivel; quantidade: number }[] {
  if (!valor) return [];
  return valor
    .split(";")
    .map((par) => par.split("="))
    .filter(([t, q]) => TIPOS.includes(t as TipoSensivel) && Number(q) > 0)
    .map(([t, q]) => ({ tipo: t as TipoSensivel, quantidade: Number(q) }));
}

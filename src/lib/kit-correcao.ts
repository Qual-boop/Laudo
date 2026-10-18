import type { Severidade } from "@/lib/tipos";

/**
 * Kit de correção para o time de desenvolvimento.
 *
 * O relatório diz O QUÊ está errado; o kit diz COMO corrigir na stack do
 * cliente e COMO provar que corrigiu: código vulnerável × corrigido, um
 * teste automatizado para a suíte do projeto e o comando de reteste que
 * reproduz a evidência. Tudo pronto para colar numa issue ou PR.
 *
 * O código é ilustrativo do padrão de correção — a IA não conhece o
 * código real do cliente e o prompt proíbe fingir que conhece.
 */

export type Stack = "node" | "python" | "java" | "php" | "dotnet" | "go" | "ruby";

export const STACKS: Record<Stack, { rotulo: string; linguagem: string; testes: string }> = {
  node: { rotulo: "Node.js / TypeScript", linguagem: "typescript", testes: "Jest ou Vitest com supertest" },
  python: { rotulo: "Python (Django, Flask, FastAPI)", linguagem: "python", testes: "pytest" },
  java: { rotulo: "Java (Spring Boot)", linguagem: "java", testes: "JUnit 5 com MockMvc" },
  php: { rotulo: "PHP (Laravel)", linguagem: "php", testes: "PHPUnit (Feature test do Laravel)" },
  dotnet: { rotulo: "C# / ASP.NET Core", linguagem: "csharp", testes: "xUnit com WebApplicationFactory" },
  go: { rotulo: "Go", linguagem: "go", testes: "testing + net/http/httptest" },
  ruby: { rotulo: "Ruby on Rails", linguagem: "ruby", testes: "RSpec (request spec)" },
};

export function ehStack(v: unknown): v is Stack {
  return typeof v === "string" && v in STACKS;
}

export type AchadoParaKit = {
  ref: string;
  titulo: string;
  severidade: Severidade;
  cwe: string;
  descricao: string;
  evidencia: string;
  passos: string[];
  remediacao: string;
};

export type KitCorrecao = {
  ref: string;
  stack: Stack;
  linguagem: string;
  resumo: string;
  causaRaiz: string;
  codigoVulneravel: string;
  codigoCorrigido: string;
  testeAutomatizado: string;
  reteste: { descricao: string; comando: string };
  checklist: string[];
  referencias: string[];
  origem: "ia" | "local";
};

const MAX_CODIGO = 6000;
const MAX_TEXTO = 3000;

function texto(v: unknown, max = MAX_TEXTO): string {
  if (typeof v !== "string") return "";
  const s = v.replace(/^```[a-z]*\n?|```$/gim, "").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function lista(v: unknown, max = 8): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => texto(x, 400)).slice(0, max)
    : [];
}

function numeroCwe(cwe: string): number | null {
  const m = cwe.match(/(\d{1,5})/);
  return m ? Number(m[1]) : null;
}

export function urlCwe(cwe: string): string | null {
  const n = numeroCwe(cwe);
  return n ? `https://cwe.mitre.org/data/definitions/${n}.html` : null;
}

/* ------------------------------------------------------------------ *
 * Comando de reteste a partir da evidência (requisição HTTP crua)
 * ------------------------------------------------------------------ */

function aspas(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** Cabeçalhos que carregam credencial viram placeholder no comando. */
const CABECALHOS_CREDENCIAL = /^(authorization|cookie|x-api-key|x-auth-token|proxy-authorization)$/i;
const CABECALHOS_IGNORADOS = /^(host|content-length|connection|accept-encoding|upgrade-insecure-requests)$/i;

/**
 * Transforma uma requisição HTTP colada na evidência num curl de reteste.
 * Devolve null se não houver linha de requisição reconhecível.
 */
export function comandoReteste(evidencia: string): string | null {
  const linhas = evidencia.replace(/\r/g, "").split("\n");
  const inicio = linhas.findIndex((l) =>
    /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\S+(\s+HTTP\/[\d.]+)?\s*$/i.test(l.trim()),
  );
  if (inicio < 0) return null;

  const [metodo, alvo] = linhas[inicio].trim().split(/\s+/);
  const cabecalhos: string[] = [];
  let host = "";
  let i = inicio + 1;
  for (; i < linhas.length && linhas[i].trim() !== ""; i++) {
    const m = linhas[i].match(/^([A-Za-z0-9-]+):\s*(.*)$/);
    if (!m) break;
    const [, nome, valor] = m;
    if (/^host$/i.test(nome)) host = valor.trim().split(/\s/)[0];
    if (CABECALHOS_IGNORADOS.test(nome)) continue;
    cabecalhos.push(CABECALHOS_CREDENCIAL.test(nome) ? `${nome}: <${nome.toUpperCase()}_DO_USUARIO_DE_TESTE>` : `${nome}: ${valor.trim()}`);
  }
  const corpo = linhas.slice(i + 1).join("\n").trim();
  const url = /^https?:\/\//i.test(alvo) ? alvo : `https://${host || "ALVO"}${alvo.startsWith("/") ? "" : "/"}${alvo}`;

  const partes = [`curl -i -s -X ${metodo.toUpperCase()} ${aspas(url)}`];
  for (const c of cabecalhos) partes.push(`  -H ${aspas(c)}`);
  if (corpo && !/^(GET|HEAD)$/i.test(metodo)) partes.push(`  --data-raw ${aspas(corpo)}`);
  return partes.join(" \\\n");
}

/* ------------------------------------------------------------------ *
 * Conhecimento local por CWE (fallback sem IA)
 * ------------------------------------------------------------------ */

type Guia = { checklist: string[]; cheatSheet: string };

const OWASP_CS = "https://cheatsheetseries.owasp.org/cheatsheets/";

const GUIAS: Record<number, Guia> = {
  89: {
    checklist: [
      "Trocar toda concatenação de SQL por consultas parametrizadas (prepared statements) ou pelo ORM.",
      "Validar tipo e formato dos parâmetros (allowlist) antes de usá-los.",
      "Executar a aplicação com usuário de banco de privilégio mínimo.",
      "Procurar o mesmo padrão nas demais consultas do projeto (grep por concatenação em SQL).",
    ],
    cheatSheet: "SQL_Injection_Prevention_Cheat_Sheet.html",
  },
  78: {
    checklist: [
      "Eliminar chamadas de shell com entrada do usuário; usar APIs da linguagem em vez de comandos.",
      "Se o comando for inevitável, passar argumentos como lista (sem shell) e validar por allowlist.",
      "Rodar o processo com privilégio mínimo e sem acesso a segredos.",
    ],
    cheatSheet: "OS_Command_Injection_Defense_Cheat_Sheet.html",
  },
  79: {
    checklist: [
      "Codificar a saída conforme o contexto (HTML, atributo, JavaScript, URL); usar o escape automático do template.",
      "Nunca inserir HTML do usuário com innerHTML/dangerouslySetInnerHTML sem sanitizador (ex.: DOMPurify).",
      "Adicionar Content-Security-Policy que bloqueie scripts inline.",
      "Marcar o cookie de sessão como HttpOnly.",
    ],
    cheatSheet: "Cross_Site_Scripting_Prevention_Cheat_Sheet.html",
  },
  639: {
    checklist: [
      "Em toda rota que recebe um ID, conferir no servidor se o recurso pertence ao usuário autenticado.",
      "Responder 404 (não 403) para recurso de outro dono, sem revelar que ele existe.",
      "Centralizar a checagem de propriedade (middleware/policy) em vez de repetir por rota.",
      "Preferir identificadores não sequenciais (UUID) como defesa em profundidade, não como correção.",
    ],
    cheatSheet: "Authorization_Cheat_Sheet.html",
  },
  285: {
    checklist: [
      "Checar o perfil do usuário no servidor em todas as rotas administrativas, não só na interface.",
      "Negar por padrão: rota sem regra explícita exige o perfil mais alto.",
      "Cobrir com testes que chamam as rotas administrativas com usuário comum.",
    ],
    cheatSheet: "Authorization_Cheat_Sheet.html",
  },
  22: {
    checklist: [
      "Não montar caminhos com entrada do usuário; mapear IDs para arquivos permitidos.",
      "Se inevitável, normalizar o caminho e confirmar que continua dentro do diretório base.",
      "Rodar o processo sem permissão de leitura fora do diretório da aplicação.",
    ],
    cheatSheet: "Input_Validation_Cheat_Sheet.html",
  },
  918: {
    checklist: [
      "Permitir só destinos de uma allowlist de domínios/esquemas.",
      "Resolver o DNS e bloquear IPs internos, loopback e o endpoint de metadados da nuvem (169.254.169.254).",
      "Desabilitar redirecionamentos automáticos na requisição de saída.",
    ],
    cheatSheet: "Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html",
  },
  352: {
    checklist: [
      "Exigir token anti-CSRF em toda ação que altera estado.",
      "Definir SameSite=Lax ou Strict no cookie de sessão.",
      "Não aceitar GET para ações que alteram estado.",
    ],
    cheatSheet: "Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html",
  },
  434: {
    checklist: [
      "Validar tipo pelo conteúdo (magic bytes), não pela extensão ou Content-Type enviado.",
      "Gravar fora da raiz web, com nome gerado pelo servidor, e servir com Content-Disposition: attachment.",
      "Limitar tamanho e, se possível, passar o arquivo por antivírus.",
    ],
    cheatSheet: "File_Upload_Cheat_Sheet.html",
  },
  611: {
    checklist: [
      "Desabilitar DTD e entidades externas no parser XML.",
      "Preferir JSON quando o XML não for obrigatório.",
    ],
    cheatSheet: "XML_External_Entity_Prevention_Cheat_Sheet.html",
  },
  347: {
    checklist: [
      "Fixar o algoritmo esperado na verificação do JWT e recusar \"none\".",
      "Usar chave forte (HS256 com 256 bits aleatórios ou RS256/ES256) guardada como segredo.",
      "Validar exp, iss e aud em toda requisição.",
    ],
    cheatSheet: "JSON_Web_Token_for_Java_Cheat_Sheet.html",
  },
  307: {
    checklist: [
      "Limitar tentativas por conta e por IP com bloqueio progressivo.",
      "Oferecer MFA e checar senhas contra listas vazadas.",
      "Registrar e alertar picos de falha de login.",
    ],
    cheatSheet: "Authentication_Cheat_Sheet.html",
  },
  942: {
    checklist: [
      "Trocar o reflexo do Origin por uma allowlist explícita.",
      "Nunca combinar Allow-Credentials: true com origem curinga ou refletida.",
    ],
    cheatSheet: "HTML5_Security_Cheat_Sheet.html",
  },
  601: {
    checklist: [
      "Aceitar só caminhos relativos internos ou destinos de uma allowlist.",
      "Em fluxos OAuth, registrar as redirect_uri exatas no provedor.",
    ],
    cheatSheet: "Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html",
  },
  693: {
    checklist: [
      "Configurar Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options: nosniff e frame-ancestors.",
      "Aplicar os cabeçalhos no proxy/CDN ou no middleware global, não por rota.",
    ],
    cheatSheet: "HTTP_Headers_Cheat_Sheet.html",
  },
  1004: {
    checklist: ["Marcar o cookie de sessão com HttpOnly, Secure e SameSite."],
    cheatSheet: "Session_Management_Cheat_Sheet.html",
  },
  326: {
    checklist: [
      "Desabilitar TLS 1.0/1.1 e suítes fracas (3DES, RC4, CBC antigas).",
      "Habilitar TLS 1.2+ com forward secrecy e HSTS.",
      "Revalidar com uma ferramenta de varredura de TLS após a mudança.",
    ],
    cheatSheet: "Transport_Layer_Security_Cheat_Sheet.html",
  },
  770: {
    checklist: [
      "Aplicar rate limiting por usuário e por IP nos endpoints sensíveis ou custosos.",
      "Responder 429 com Retry-After e monitorar abuso.",
    ],
    cheatSheet: "Denial_of_Service_Cheat_Sheet.html",
  },
  1104: {
    checklist: [
      "Atualizar o componente para a versão corrigida indicada pelo fornecedor.",
      "Adicionar análise de dependências (SCA) no CI para bloquear versões vulneráveis.",
      "Conferir se outros serviços usam a mesma versão.",
    ],
    cheatSheet: "Vulnerable_Dependency_Management_Cheat_Sheet.html",
  },
};

const GUIA_GENERICO: Guia = {
  checklist: [
    "Reproduzir o achado em ambiente de homologação com a evidência do relatório.",
    "Aplicar a correção definitiva descrita no relatório (não só a mitigação).",
    "Cobrir o caso com um teste automatizado que falhava antes da correção.",
    "Procurar o mesmo padrão em outras partes do código.",
  ],
  cheatSheet: "https://cheatsheetseries.owasp.org/index.html",
};

function guiaDe(cwe: string): Guia {
  const n = numeroCwe(cwe);
  return (n && GUIAS[n]) || GUIA_GENERICO;
}

function referenciasPadrao(cwe: string): string[] {
  const cs = guiaDe(cwe).cheatSheet;
  const refs = [cs.startsWith("http") ? cs : `${OWASP_CS}${cs}`];
  const u = urlCwe(cwe);
  if (u) refs.push(u);
  return refs;
}

/** Kit sem IA: checklist do CWE, reteste da evidência e referências. */
export function kitLocal(a: AchadoParaKit, stack: Stack): KitCorrecao {
  const comando = comandoReteste(a.evidencia);
  return {
    ref: a.ref,
    stack,
    linguagem: STACKS[stack].linguagem,
    resumo: `${a.titulo} — corrigir na aplicação ${STACKS[stack].rotulo}.`,
    causaRaiz: a.descricao || "Ver descrição técnica do relatório.",
    codigoVulneravel: "",
    codigoCorrigido: "",
    testeAutomatizado: "",
    reteste: comando
      ? {
          descricao:
            "Repita a requisição da evidência. Após a correção, a resposta não pode mais reproduzir o comportamento descrito no relatório.",
          comando,
        }
      : {
          descricao: "Repita os passos de reprodução do relatório e registre a nova evidência no Provafix.",
          comando: "",
        },
    checklist: guiaDe(a.cwe).checklist,
    referencias: referenciasPadrao(a.cwe),
    origem: "local",
  };
}

/* ------------------------------------------------------------------ *
 * IA
 * ------------------------------------------------------------------ */

export function montarPromptKit(a: AchadoParaKit, stack: Stack): string {
  const s = STACKS[stack];
  return `Você é um engenheiro sênior de AppSec ajudando o time de desenvolvimento a CORRIGIR uma vulnerabilidade encontrada em pentest. Escreva em português do Brasil. Não use emojis.

ACHADO ${a.ref}
título: ${a.titulo}
severidade: ${a.severidade}
cwe: ${a.cwe || "(não informada)"}
descrição técnica: ${a.descricao || "(não informada)"}
evidência: ${a.evidencia || "(não fornecida)"}
passos de reprodução: ${a.passos.length ? a.passos.join(" | ") : "(não informados)"}
remediação recomendada no relatório: ${a.remediacao || "(não informada)"}

STACK DO CLIENTE: ${s.rotulo}

Produza EXATAMENTE um objeto JSON válido, sem markdown e sem texto fora dele:
{
  "resumo": string,              // 1-2 frases para o dev: o que corrigir e onde procurar
  "causaRaiz": string,           // por que o código está vulnerável (o padrão, não o caso)
  "codigoVulneravel": string,    // trecho curto em ${s.linguagem} com o padrão vulnerável
  "codigoCorrigido": string,     // o mesmo trecho corrigido, idiomático para ${s.rotulo}
  "testeAutomatizado": string,   // teste em ${s.testes} que FALHA antes e PASSA depois da correção
  "reteste": { "descricao": string, "comando": string }, // comando curl que reproduz a evidência; vazio se não houver requisição
  "checklist": string[],         // 3 a 6 itens objetivos para fechar o achado
  "referencias": string[]        // URLs: cheat sheet da OWASP e a página do CWE
}

REGRAS
1. O código é ILUSTRATIVO do padrão de correção. Você não conhece o código real do cliente: não invente nomes de arquivos, classes ou rotas dele além dos que aparecem na evidência.
2. Código curto (até ~40 linhas por bloco), com comentários em português, sem crases de markdown.
3. A correção precisa tratar a causa raiz (ex.: consulta parametrizada, checagem de propriedade no servidor), não só a mitigação.
4. No comando de reteste, substitua credenciais por placeholders como <TOKEN_DO_USUARIO_DE_TESTE>.
5. Marcadores como [[IP-1]], [[HOST-2]] ou [[CLIENTE-1]] substituem dados confidenciais: copie-os exatamente como aparecem, onde fizer sentido. Nunca invente nem remova marcadores.

Responda SOMENTE com o JSON.`;
}

/** Normaliza a resposta da IA; campos ruins caem no conhecimento local. */
export function normalizarKit(bruto: Record<string, unknown>, a: AchadoParaKit, stack: Stack): KitCorrecao {
  const local = kitLocal(a, stack);
  const reteste = (bruto.reteste && typeof bruto.reteste === "object" ? bruto.reteste : {}) as Record<string, unknown>;
  const comandoIa = texto(reteste.comando, 2000);
  const checklist = lista(bruto.checklist);
  const referencias = lista(bruto.referencias).filter((r) => /^https?:\/\//i.test(r));
  return {
    ...local,
    resumo: texto(bruto.resumo) || local.resumo,
    causaRaiz: texto(bruto.causaRaiz) || local.causaRaiz,
    codigoVulneravel: texto(bruto.codigoVulneravel, MAX_CODIGO),
    codigoCorrigido: texto(bruto.codigoCorrigido, MAX_CODIGO),
    testeAutomatizado: texto(bruto.testeAutomatizado, MAX_CODIGO),
    reteste: {
      descricao: texto(reteste.descricao) || local.reteste.descricao,
      // O curl montado da evidência real vence o da IA quando existe.
      comando: local.reteste.comando || comandoIa,
    },
    checklist: checklist.length >= 2 ? checklist : local.checklist,
    referencias: referencias.length ? referencias : local.referencias,
    origem: "ia",
  };
}

/** Markdown pronto para issue do GitHub/Jira ou descrição de PR. */
export function kitEmMarkdown(k: KitCorrecao, titulo: string): string {
  const bloco = (codigo: string, linguagem = k.linguagem) => `\`\`\`${linguagem}\n${codigo}\n\`\`\``;
  const partes = [
    `## ${k.ref} — ${titulo}`,
    `**Stack:** ${STACKS[k.stack].rotulo}`,
    `### O que corrigir\n${k.resumo}`,
    `### Causa raiz\n${k.causaRaiz}`,
    k.codigoVulneravel ? `### Antes (vulnerável)\n${bloco(k.codigoVulneravel)}` : "",
    k.codigoCorrigido ? `### Depois (corrigido)\n${bloco(k.codigoCorrigido)}` : "",
    k.testeAutomatizado ? `### Teste automatizado\n${bloco(k.testeAutomatizado)}` : "",
    k.reteste.comando ? `### Reteste\n${k.reteste.descricao}\n\n${bloco(k.reteste.comando, "bash")}` : "",
    `### Checklist\n${k.checklist.map((c) => `- [ ] ${c}`).join("\n")}`,
    `### Referências\n${k.referencias.map((r) => `- ${r}`).join("\n")}`,
    "_Gerado pelo Provafix — o código é ilustrativo do padrão de correção; adapte ao seu projeto._",
  ];
  return partes.filter(Boolean).join("\n\n");
}

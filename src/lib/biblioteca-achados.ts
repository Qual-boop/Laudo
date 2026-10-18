import type { AchadoEntrada, Severidade } from "@/lib/tipos";

/**
 * Biblioteca de achados em português: o ponto de partida dos problemas
 * mais comuns em pentest web/API/infra. O pentester escolhe o modelo,
 * ajusta ao caso e cola a evidência — a IA expande o resto (CVSS, OWASP,
 * passos, remediação). Severidade é a típica, não uma regra: o contexto
 * do cliente manda.
 */

export type CategoriaModelo = "Injeção" | "Controle de acesso" | "Autenticação e sessão" | "Configuração" | "Criptografia" | "Componentes";

export type ModeloAchado = {
  id: string;
  categoria: CategoriaModelo;
  titulo: string;
  severidade: Severidade;
  cwe: string;
  descricao: string;
};

export const BIBLIOTECA: ModeloAchado[] = [
  /* ---------------------------------------------------------- Injeção */
  {
    id: "sqli",
    categoria: "Injeção",
    titulo: "SQL Injection",
    severidade: "Critica",
    cwe: "CWE-89",
    descricao:
      "Um parâmetro controlado pelo usuário é concatenado a uma consulta SQL sem parametrização, permitindo alterar a lógica da consulta. Dependendo do banco e das permissões, viabiliza leitura e alteração de dados, desvio de autenticação e, em alguns casos, execução de comandos no servidor.",
  },
  {
    id: "cmdi",
    categoria: "Injeção",
    titulo: "Injeção de comandos do sistema operacional",
    severidade: "Critica",
    cwe: "CWE-78",
    descricao:
      "Dados do usuário chegam a uma chamada de shell sem validação nem escape, permitindo encadear comandos arbitrários com os privilégios do processo da aplicação — normalmente o comprometimento completo do servidor.",
  },
  {
    id: "xss-armazenado",
    categoria: "Injeção",
    titulo: "Cross-Site Scripting (XSS) armazenado",
    severidade: "Alta",
    cwe: "CWE-79",
    descricao:
      "Conteúdo enviado por um usuário é gravado e depois exibido a outros usuários sem codificação de saída, executando JavaScript no navegador das vítimas. Permite sequestro de sessão, ações em nome da vítima e captura de dados digitados.",
  },
  {
    id: "xss-refletido",
    categoria: "Injeção",
    titulo: "Cross-Site Scripting (XSS) refletido",
    severidade: "Media",
    cwe: "CWE-79",
    descricao:
      "Um parâmetro da requisição é devolvido na resposta sem codificação de saída, executando JavaScript quando a vítima abre um link preparado pelo atacante. Viabiliza phishing convincente e roubo de sessão quando o cookie não é HttpOnly.",
  },
  {
    id: "ssrf",
    categoria: "Injeção",
    titulo: "Server-Side Request Forgery (SSRF)",
    severidade: "Alta",
    cwe: "CWE-918",
    descricao:
      "A aplicação busca uma URL informada pelo usuário sem restringir o destino, fazendo o servidor acessar recursos internos — painéis administrativos, serviços sem autenticação e endpoints de metadados da nuvem que expõem credenciais.",
  },
  {
    id: "xxe",
    categoria: "Injeção",
    titulo: "XML External Entity (XXE)",
    severidade: "Alta",
    cwe: "CWE-611",
    descricao:
      "O parser XML resolve entidades externas declaradas no documento enviado, permitindo ler arquivos do servidor, fazer requisições internas (SSRF) e, em alguns parsers, causar negação de serviço.",
  },
  {
    id: "path-traversal",
    categoria: "Injeção",
    titulo: "Path traversal (leitura de arquivos arbitrários)",
    severidade: "Alta",
    cwe: "CWE-22",
    descricao:
      "Um parâmetro usado para montar caminhos de arquivo aceita sequências como ../, permitindo ler arquivos fora do diretório previsto — código-fonte, arquivos de configuração e segredos.",
  },
  {
    id: "upload",
    categoria: "Injeção",
    titulo: "Upload de arquivo sem restrição",
    severidade: "Alta",
    cwe: "CWE-434",
    descricao:
      "O envio de arquivos não valida tipo, conteúdo nem destino, permitindo publicar um script executável no servidor (web shell) ou conteúdo malicioso servido a outros usuários pelo domínio da empresa.",
  },
  {
    id: "open-redirect",
    categoria: "Injeção",
    titulo: "Redirecionamento aberto (open redirect)",
    severidade: "Baixa",
    cwe: "CWE-601",
    descricao:
      "Um parâmetro de retorno aceita qualquer URL de destino, permitindo que links legítimos da empresa levem a páginas do atacante — base para phishing e, em fluxos OAuth, para roubo de tokens.",
  },

  /* ------------------------------------------------ Controle de acesso */
  {
    id: "idor",
    categoria: "Controle de acesso",
    titulo: "Referência direta insegura a objeto (IDOR/BOLA)",
    severidade: "Alta",
    cwe: "CWE-639",
    descricao:
      "A API identifica registros por um ID previsível e não confere se o usuário autenticado é o dono do recurso. Trocar o ID na requisição dá acesso a dados de outros clientes.",
  },
  {
    id: "privesc-vertical",
    categoria: "Controle de acesso",
    titulo: "Escalação de privilégio vertical (função administrativa sem checagem)",
    severidade: "Alta",
    cwe: "CWE-285",
    descricao:
      "Funções administrativas só são escondidas na interface; o endpoint não verifica o perfil do usuário. Um usuário comum executa ações de administrador chamando a rota diretamente.",
  },
  {
    id: "exposicao-dados",
    categoria: "Controle de acesso",
    titulo: "Exposição excessiva de dados na API",
    severidade: "Media",
    cwe: "CWE-213",
    descricao:
      "A API devolve objetos completos e confia na interface para esconder campos. A resposta bruta revela dados pessoais ou internos que o usuário não deveria ver, com reflexo direto em LGPD.",
  },
  {
    id: "cors",
    categoria: "Controle de acesso",
    titulo: "CORS permissivo com credenciais",
    severidade: "Media",
    cwe: "CWE-942",
    descricao:
      "O servidor reflete qualquer Origin em Access-Control-Allow-Origin junto com Allow-Credentials, permitindo que um site do atacante leia respostas autenticadas da API usando a sessão da vítima.",
  },
  {
    id: "csrf",
    categoria: "Controle de acesso",
    titulo: "Cross-Site Request Forgery (CSRF)",
    severidade: "Media",
    cwe: "CWE-352",
    descricao:
      "Ações que alteram estado não exigem token anti-CSRF nem dependem de cookies SameSite, permitindo que uma página externa faça o navegador da vítima executar a ação com a sessão dela.",
  },

  /* ------------------------------------------- Autenticação e sessão */
  {
    id: "jwt",
    categoria: "Autenticação e sessão",
    titulo: "JWT aceito sem validação de assinatura",
    severidade: "Critica",
    cwe: "CWE-347",
    descricao:
      "O backend aceita tokens com algoritmo \"none\", assinatura inválida ou chave fraca, permitindo forjar um token com qualquer identidade ou perfil — inclusive administrador.",
  },
  {
    id: "credenciais-padrao",
    categoria: "Autenticação e sessão",
    titulo: "Credenciais padrão em uso",
    severidade: "Alta",
    cwe: "CWE-1392",
    descricao:
      "Um serviço ou painel aceita o usuário e a senha de fábrica documentados publicamente, dando acesso sem nenhum esforço de ataque.",
  },
  {
    id: "forca-bruta",
    categoria: "Autenticação e sessão",
    titulo: "Login sem proteção contra força bruta",
    severidade: "Media",
    cwe: "CWE-307",
    descricao:
      "O login não limita tentativas nem exige desafio adicional após falhas, permitindo testar senhas em massa e vazamentos conhecidos (credential stuffing).",
  },
  {
    id: "enumeracao",
    categoria: "Autenticação e sessão",
    titulo: "Enumeração de usuários",
    severidade: "Baixa",
    cwe: "CWE-204",
    descricao:
      "Mensagens, códigos ou tempos de resposta diferentes no login ou na recuperação de senha revelam se um e-mail está cadastrado, alimentando phishing e força bruta direcionada.",
  },
  {
    id: "cookie-flags",
    categoria: "Autenticação e sessão",
    titulo: "Cookie de sessão sem HttpOnly/Secure",
    severidade: "Baixa",
    cwe: "CWE-1004",
    descricao:
      "O cookie de sessão é acessível por JavaScript e/ou trafega sem HTTPS, ampliando o impacto de um XSS e permitindo captura em redes não confiáveis.",
  },

  /* ---------------------------------------------------- Configuração */
  {
    id: "rate-limit",
    categoria: "Configuração",
    titulo: "Ausência de limite de requisições (rate limiting)",
    severidade: "Media",
    cwe: "CWE-770",
    descricao:
      "Endpoints sensíveis ou custosos aceitam requisições ilimitadas, permitindo abuso automatizado (envio de SMS/e-mail, raspagem de dados) e degradação do serviço.",
  },
  {
    id: "headers",
    categoria: "Configuração",
    titulo: "Cabeçalhos de segurança HTTP ausentes",
    severidade: "Baixa",
    cwe: "CWE-693",
    descricao:
      "As respostas não definem Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options e proteção contra framing, removendo camadas de defesa contra XSS, clickjacking e rebaixamento para HTTP.",
  },
  {
    id: "banner",
    categoria: "Configuração",
    titulo: "Divulgação de versões e detalhes técnicos",
    severidade: "Baixa",
    cwe: "CWE-200",
    descricao:
      "Cabeçalhos, páginas de erro ou banners revelam produto e versão exata dos componentes, encurtando o caminho do atacante até exploits conhecidos.",
  },

  /* ---------------------------------------------------- Criptografia */
  {
    id: "tls-fraco",
    categoria: "Criptografia",
    titulo: "TLS com protocolos ou cifras obsoletos",
    severidade: "Media",
    cwe: "CWE-326",
    descricao:
      "O servidor aceita TLS 1.0/1.1 ou suítes de cifra fracas, expondo o tráfego a ataques de rebaixamento e descriptografia e descumprindo exigências como o PCI DSS.",
  },

  /* ------------------------------------------------------ Componentes */
  {
    id: "componente-vulneravel",
    categoria: "Componentes",
    titulo: "Componente desatualizado com vulnerabilidade conhecida (CVE)",
    severidade: "Alta",
    cwe: "CWE-1104",
    descricao:
      "Uma biblioteca, framework ou serviço está em versão com CVE público e exploração documentada. Indique o componente, a versão encontrada, o CVE e a versão corrigida.",
  },
];

export const CATEGORIAS: CategoriaModelo[] = [
  "Injeção",
  "Controle de acesso",
  "Autenticação e sessão",
  "Configuração",
  "Criptografia",
  "Componentes",
];

/** Preenche um achado do formulário a partir do modelo. */
export function achadoDoModelo(id: string): AchadoEntrada | null {
  const m = BIBLIOTECA.find((x) => x.id === id);
  if (!m) return null;
  return {
    titulo: m.titulo,
    severidade: m.severidade,
    cwe: m.cwe,
    descricao: m.descricao,
    evidencia: "",
    confianca: "Media",
    dataRetesteSugerida: "",
  };
}

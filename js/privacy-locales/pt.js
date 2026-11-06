export default {
  "title": "privacidade, sem nevoeiro.",
  "intro": [
    "não queremos os teus dados.",
    "as visitas tornam-se totais anónimos, sem cookies de rastreio.",
    "o pouco que guardamos (um voto ou código de acesso) está aqui e expira."
  ],
  "updated": "2026-11-06",
  "sections": [
    [
      "who",
      "quem segura a lanterna?",
      "Francisco Gabriel Van Langenhove é responsável por corvus.gent e stats.corvus.gent, incluindo música e jogos. perguntas e pedidos: <a href=\"mailto:gabriel@corvus.gent\">gabriel@corvus.gent</a>."
    ],
    [
      "counts",
      "o que contamos",
      "o PostHog EU conta visitas e ações permitidas por defeito, sem cookies, armazenamento no navegador, perfis ou gravações. cria temporariamente um pseudónimo diário com informação de rede/navegador; só os totais são anónimos. não recebe nomes, emails ou formulários. GPC, DNT ou ‘não me contes’ impedem o PostHog de carregar: só aumenta um contador página/dia, sem ID, hash ou cabeçalhos guardados. estes acessos não são pessoas únicas."
    ],
    [
      "why",
      "porquê e com que fundamento",
      "o interesse legítimo é a base declarada da contagem simples sem cookies e da prevenção de abusos. o Spotify precisa do teu clique. emails de acesso, votos e reservas cumprem o teu pedido. podes recusar o PostHog aqui; fica apenas um acesso anónimo. não vendemos dados."
    ],
    [
      "storage",
      "o que fica e durante quanto tempo",
      "código: 3 minutos. sessão: 7 dias ou até terminares a sessão. registos de acesso, pedidos e previsões associadas a email: até 90 dias. limites antiabuso: até 24 horas, com um hash de IP com sal diferente a cada dia; a aplicação não guarda IPs em bruto. desafios antibots: 5 minutos. histórico do jogo no servidor: 48 horas após utilização; séries e controlo de votos repetidos: até um ano. totais anónimos e sugestões musicais públicas podem ficar até serem removidos.",
      "a retenção de eventos depende da definição do PostHog; pretendemos 90 dias, mas essa definição ainda precisa de confirmação. alojamento e email têm prazos próprios para registos e cópias de segurança. pede-me os detalhes atuais.",
      "Resend: armazenamento nos EUA; emails/registos 30 dias em Free/Pro/Scale, cópias 7 dias; Enterprise pode variar. <a href=\"https://resend.com/security/gdpr/\" rel=\"noreferrer\">Resend GDPR</a>."
    ],
    [
      "sf",
      "mensagens da viagem a sf",
      "se enviares o formulário sf, só o gabe vê nome, contacto, trabalho, planos, datas, local e mensagem no painel privado. servem para organizar o encontro pedido (execução do teu pedido), não para marketing. cada registo é apagado automaticamente do Redis 60 dias após o envio; marcar como concluído não prolonga esse prazo.",
      "uma cópia é enviada para gabriel@corvus.gent pelo Resend, a exceção documentada de armazenamento nos eua. o Resend tem a sua própria retenção de registos; o gabe deve apagar a notificação da caixa de correio nos mesmos 60 dias. podes pedir para apagar antes, mesmo com um nome do x ou perfil do linkedin.",
      "o cookie assinado vid também previne abusos do formulário; os desafios expiram em 5 minutos, os hashes ip mudam diariamente e expiram num dia, e os recibos de repetição em 24 horas. o bilhete usa sessionStorage (sf-note:2026-11) para surgir uma vez por sessão do separador. as estatísticas opcionais contam ações, nunca os campos."
    ],
    [
      "browser",
      "no teu navegador",
      "cookies necessários: sess mantém a sessão; vid evita votos de idioma repetidos; mvid guarda votos musicais e progresso diário. são assinados, seguros e inacessíveis aos scripts. sess expira em 7 dias; vid e mvid num ano. nunca servem para te identificar em analytics.",
      "uma marca local privacy-choice lembra ‘ok’ ou ‘não me contes’. ‘ok’ acrescenta um soldier por navegador/origem do site; apagar os dados pode permitir outro. a marca não vai para o PostHog. analytics e campanhas ficam em memória, sem armazenamento no navegador."
    ],
    [
      "outside",
      "outros serviços",
      "o Spotify só recebe o pedido de reprodução depois do clique e pode então guardar os seus cookies. o nosso servidor consulta Spotify ou Apple quando envias um link musical. os mapas CARTO passam pelo nosso servidor sem enviar o teu IP. Leaflet, Sortable e a biblioteca PostHog estão alojados aqui.",
      "Buy Me a Coffee e Pidgy são links, não formulários incorporados. aplicam-se as suas políticas após a visita. /links, /go e os atalhos de campanha só acrescentam etiquetas UTM e contam visitas/cliques, sem recolher formulários ou identidades.",
      "o Notion guarda o meu registo manual de X. as estatísticas públicas mostram totais, nomes públicos de campanhas e vozes, e os meus próprios posts; respostas e URLs de destino ficam atrás do início de sessão. campanhas aprovadas e intervalos região-hora acompanham a análise opcional. as cópias no Corvus expiram em 24 horas; as fontes seguem a minha retenção no Notion. a região ainda precisa de confirmação, sem promessa de armazenamento só na UE.",
      "para contar cafés, o servidor lê brevemente os registos de Buy Me a Coffee e reconhece apoiantes recorrentes pela conta ou pelo email quando disponível. só os totais e a data do último café ficam em cache por 30 minutos.",
      "o PostHog EU conta visitas e ações permitidas por defeito, sem cookies, armazenamento no navegador, perfis ou gravações. cria temporariamente um pseudónimo diário com informação de rede/navegador; só os totais são anónimos. não recebe nomes, emails ou formulários. GPC, DNT ou ‘não me contes’ impedem o PostHog de carregar: só aumenta um contador página/dia, sem ID, hash ou cabeçalhos guardados. estes acessos não são pessoas únicas."
    ],
    [
      "where",
      "para onde vão os dados",
      "as nossas funções Vercel estão configuradas em Frankfurt (fra1). os ficheiros estáticos e o encaminhamento usam uma rede global. o PostHog EU está em Frankfurt. Frankfurt é também o destino previsto para o Redis; a região atual e a migração ainda precisam de verificação.",
      "o Resend continua como exceção temporária: a Irlanda é a região de envio prevista, por confirmar na conta, mas o conteúdo dos emails e os registos são guardados nos EUA. enviar pela Irlanda não altera isso. <a href=\"https://resend.com/docs/dashboard/domains/regions\" rel=\"noreferrer\">Resend</a>.",
      "a Vercel é uma empresa americana. o seu <a href=\"https://vercel.com/legal/dpa\" rel=\"noreferrer\">Vercel DPA</a> e o <a href=\"https://vercel.com/security\" rel=\"noreferrer\">EU–US Data Privacy Framework</a> oferecem salvaguardas nas transferências; não significam que todos os registos, acessos de suporte ou cópias fiquem na UE. falta confirmar as definições da conta e os acordos aplicáveis."
    ],
    [
      "rights",
      "os teus direitos",
      "escreve-me para aceder, corrigir, apagar, limitar ou transferir os teus dados, ou para te opores ao tratamento baseado no interesse legítimo. fechar o leitor ou a página retira o consentimento de reprodução; o Spotify gere os cookies já colocados. respondemos normalmente num mês. podemos pedir prova proporcional de que os dados são teus; não conseguimos associar totais anónimos a ti.",
      "podes reclamar junto da Autoridade belga de Proteção de Dados: <a href=\"https://www.gegevensbeschermingsautoriteit.be/\" rel=\"noreferrer\">gegevensbeschermingsautoriteit.be</a>."
    ]
  ],
  "providersTitle": "quem ajuda este lugar a funcionar",
  "providersNote": "Vercel aloja o site, PostHog EU conta, Resend envia códigos e um serviço Redis gerido guarda registos temporários. o fornecedor Redis em uso e a região ainda precisam de confirmação; pede-me os detalhes atuais. serviços externos podem tratar dados fora do EEE ao abrigo dos seus contratos e garantias de transferência. as suas políticas também explicam registos e cópias de segurança.",
  "roles": [
    "alojamento",
    "analytics",
    "emails de acesso",
    "Redis, se Upstash",
    "Redis, se Redis Cloud",
    "mapas",
    "reprodução",
    "consulta musical",
    "apoios",
    "reservas",
    "registo manual de x"
  ],
  "consentInfo": "a contagem começa por defeito. ‘ok’ fecha o aviso e conta um soldier; não é consentimento para analytics. ‘não me contes’, GPC e DNT passam para totais anónimos de páginas. a escolha fica até a mudares ou apagares os dados. uma recusa mantém-se se o aviso mudar."
};

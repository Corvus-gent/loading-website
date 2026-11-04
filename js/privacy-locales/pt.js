export default {
  "title": "privacidade, sem nevoeiro.",
  "intro": [
    "não queremos os teus dados.",
    "com a tua permissão, as visitas tornam-se totais anónimos, sem cookies de rastreio.",
    "o pouco que guardamos (um voto ou código de acesso) está aqui e expira."
  ],
  "updated": "atualizado a 4 de novembro de 2026",
  "sections": [
    [
      "who",
      "quem segura a lanterna?",
      "Francisco Gabriel Van Langenhove é responsável por corvus.gent e stats.corvus.gent, incluindo música e jogos. perguntas e pedidos: <a href=\"mailto:gabriel@corvus.gent\">gabriel@corvus.gent</a>."
    ],
    [
      "counts",
      "o que contamos",
      "só depois de permitires analytics opcional: visitas, categorias gerais de país e navegador, destinos conhecidos e ações simples em música e jogos. PostHog EU conta sem cookies de rastreio nem perfis pessoais. processa brevemente informação de rede e navegador num pseudónimo diário; só os totais resultantes são anónimos. não enviamos nomes, emails, formulários, pesquisas ou gravações para analytics. o mapa público e pingle só usam cidades com coordenadas arredondadas e pelo menos dois visitantes contados."
    ],
    [
      "why",
      "porquê e com que fundamento",
      "consentimento: analytics opcional do PostHog e, em separado, clicar em reproduzir para Spotify. interesse legítimo: prevenir abusos e usar totais anónimos. execução do teu pedido: acesso, votos, jogos, pedidos e reservas. fecha o Spotify ou a página para parar a reprodução. não vendemos os teus dados. respeitamos do-not-track e global privacy control."
    ],
    [
      "storage",
      "o que fica e durante quanto tempo",
      "código: 3 minutos. sessão: 7 dias ou até terminares a sessão. registos de acesso, pedidos e previsões associadas a email: até 90 dias. limites antiabuso: até 24 horas, com um hash de IP com sal diferente a cada dia; a aplicação não guarda IPs em bruto. desafios antibots: 5 minutos. histórico do jogo no servidor: 48 horas após utilização; séries e controlo de votos repetidos: até um ano. totais anónimos e sugestões musicais públicas podem ficar até serem removidos.",
      "a retenção de eventos depende da definição do PostHog; pretendemos 90 dias, mas essa definição ainda precisa de confirmação. alojamento e email têm prazos próprios para registos e cópias de segurança. pede-me os detalhes atuais.",
      "Resend: armazenamento nos EUA; emails/registos 30 dias em Free/Pro/Scale, cópias 7 dias; Enterprise pode variar. <a href=\"https://resend.com/security/gdpr/\" rel=\"noreferrer\">Resend GDPR</a>."
    ],
    [
      "browser",
      "no teu navegador",
      "cookies necessários: sess mantém a sessão; vid evita votos de idioma repetidos; mvid guarda votos musicais e progresso diário. são assinados, seguros e inacessíveis aos scripts. sess expira em 7 dias; vid e mvid num ano. nunca servem para te identificar em analytics.",
      "a tua escolha de analytics e a versão de privacidade ficam neste navegador durante 180 dias ou até a política mudar. localStorage guarda o teu voto de idioma, idioma, preferência de entrada, penas, resultados e instruções lidas até um ano após serem guardados. apagar os dados do site remove preferências, não votos já enviados."
    ],
    [
      "outside",
      "outros serviços",
      "o Spotify só recebe o pedido de reprodução depois do clique e pode então guardar os seus cookies. o nosso servidor consulta Spotify ou Apple quando envias um link musical. os mapas CARTO passam pelo nosso servidor sem enviar o teu IP. Leaflet, Sortable e a biblioteca PostHog estão alojados aqui.",
      "Buy Me a Coffee e Pidgy são links, não formulários incorporados. aplicam-se as suas políticas após a visita. /links, /go e os atalhos de campanha só acrescentam etiquetas UTM e contam visitas/cliques, sem recolher formulários ou identidades. (analytics só com consentimento)."
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
    "reservas"
  ],
  "consentInfo": "analytics opcional fica desligado até o permitires. podes alterar a escolha aqui a qualquer momento. cada origem do site guarda a sua escolha por 180 dias. recusar não limita o site; só contamos visitantes que aceitam. retirar a permissão interrompe tratamentos futuros sem anular os anteriores."
};

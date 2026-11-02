import { renderSearch } from "./search.js";
/**
 * Tiny i18n layer: 7 languages, picked from ?lang=, then saved choice, then browser.
 * Elements with data-i18n="key" get their text replaced.
 */

export const LANGS = [
  ["en", "EN"], ["nl", "NL"], ["es", "ES"], ["fr", "FR"],
  ["pt", "PT"], ["de", "DE"], ["zh", "中文"],
];

const STRINGS = {
  "home.sub": {
    en: "The crow died. The domain didn't.",
    nl: "De kraai is dood. Het domein niet.",
    fr: "Le corbeau est mort. Le domaine, non.",
    es: "El cuervo murió. El dominio no.",
    pt: "O corvo morreu. O domínio não.",
    de: "Die Krähe ist tot. Die Domain nicht.",
    zh: "乌鸦死了，域名还在。",
  },
  "nav.contact": { en: "contact", nl: "contact", fr: "contact", es: "contacto", pt: "contato", de: "kontakt", zh: "联系" },
  "nav.about": { en: "about", nl: "over mij", fr: "à propos", es: "sobre mí", pt: "sobre mim", de: "über mich", zh: "关于我" },
  "nav.sidequests": { en: "sidequests", nl: "sidequests", fr: "quêtes annexes", es: "misiones secundarias", pt: "missões secundárias", de: "nebenquests", zh: "支线任务" },
  "nav.now": { en: "now", nl: "nu", fr: "maintenant", es: "ahora", pt: "agora", de: "jetzt", zh: "现在" },
  "footer.deceased": { en: "corvus · deceased 2025 · revived 2026", nl: "corvus · overleden 2025 · herrezen 2026", fr: "corvus · décédé 2025 · ressuscité 2026", es: "corvus · fallecido 2025 · resucitado 2026", pt: "corvus · falecido 2025 · ressuscitado 2026", de: "corvus · verstorben 2025 · auferstanden 2026", zh: "corvus · 2025 年逝去 · 2026 年复活" },

  "people.title": { en: "People @ Corvus", nl: "Mensen @ Corvus", fr: "Équipe @ Corvus", es: "Gente @ Corvus", pt: "Pessoas @ Corvus", de: "Leute @ Corvus", zh: "Corvus 的成员" },
  "people.population": { en: "population: 1", nl: "bevolking: 1", fr: "population : 1", es: "población: 1", pt: "população: 1", de: "Bevölkerung: 1", zh: "人口：1" },

  "profile.languages": {
    en: "Speaks 7 languages: EN · NL · ES · FR · PT · DE · 中文",
    nl: "Spreekt 7 talen: EN · NL · ES · FR · PT · DE · 中文",
    fr: "Parle 7 langues : EN · NL · ES · FR · PT · DE · 中文",
    es: "Habla 7 idiomas: EN · NL · ES · FR · PT · DE · 中文",
    pt: "Fala 7 idiomas: EN · NL · ES · FR · PT · DE · 中文",
    de: "Spricht 7 Sprachen: EN · NL · ES · FR · PT · DE · 中文",
    zh: "会说 7 种语言：EN · NL · ES · FR · PT · DE · 中文",
  },
  "sec.about": { en: "About", nl: "Over mij", fr: "À propos", es: "Sobre mí", pt: "Sobre mim", de: "Über mich", zh: "关于我" },
  "sec.research": { en: "Research", nl: "Onderzoek", fr: "Recherche", es: "Investigación", pt: "Pesquisa", de: "Forschung", zh: "研究" },
  "sec.blogs": { en: "Blogs", nl: "Blogs", fr: "Blogs", es: "Blogs", pt: "Blogs", de: "Blogs", zh: "博客" },
  "sec.shoutouts": { en: "Shout-outs", nl: "Shout-outs", fr: "Dédicaces", es: "Menciones", pt: "Menções", de: "Shout-outs", zh: "致敬" },
  "sec.contacts": { en: "Contacts", nl: "Contact", fr: "Contacts", es: "Contactos", pt: "Contatos", de: "Kontakte", zh: "联系方式" },
  "shoutouts.sub": {
    en: "cool companies and people",
    nl: "coole bedrijven en mensen",
    fr: "entreprises et gens cool",
    es: "empresas y personas geniales",
    pt: "empresas e pessoas incríveis",
    de: "coole Firmen und Leute",
    zh: "很酷的公司和人",
  },
  "blogs.cooking": { en: "cooking", nl: "aan het koken", fr: "en préparation", es: "cocinándose", pt: "cozinhando", de: "in Arbeit", zh: "酝酿中" },
  "links.bosses": { en: "my cool bosses", nl: "mijn coole bazen", fr: "mes boss cool", es: "mis jefes geniales", pt: "meus chefes incríveis", de: "meine coolen Chefs", zh: "我很酷的老板们" },

  "sq.title": { en: "Sidequests", nl: "Sidequests", fr: "Quêtes annexes", es: "Misiones secundarias", pt: "Missões secundárias", de: "Nebenquests", zh: "支线任务" },
  "sq.sub": {
    en: "Things I build when I have a creative peak.",
    nl: "Dingen die ik bouw als ik een creatieve piek heb.",
    fr: "Ce que je construis quand j'ai un pic de créativité.",
    es: "Cosas que construyo cuando tengo un pico creativo.",
    pt: "Coisas que construo quando tenho um pico criativo.",
    de: "Dinge, die ich baue, wenn ich einen kreativen Höhepunkt habe.",
    zh: "灵感爆发时做的东西。",
  },
  "sq.402.desc": {
    en: "A client stopped paying for his domain. So the site got a live timer instead. Dry, petty, legal.",
    nl: "Een klant stopte met betalen voor zijn domein. Dus kreeg de site een live teller. Droog, kleinzielig, legaal.",
    fr: "Un client a arrêté de payer son domaine. Alors le site a eu un compteur en direct. Sec, mesquin, légal.",
    es: "Un cliente dejó de pagar su dominio. Así que la web recibió un contador en vivo. Seco, mezquino, legal.",
    pt: "Um cliente parou de pagar o domínio. Então o site ganhou um contador ao vivo. Seco, mesquinho, legal.",
    de: "Ein Kunde hat seine Domain nicht mehr bezahlt. Also bekam die Seite einen Live-Timer. Trocken, kleinlich, legal.",
    zh: "一个客户不再支付域名费用，于是网站换成了实时计时器。冷幽默、小心眼、合法。",
  },
  "sq.pc.desc": {
    en: "An autonomous party robot built with ROS2 and Python. It drives around, dances salsa, plays music, talks and listens, serves beer and shoots M&M's from a mini-gun on command.",
    nl: "Een autonome feestrobot, gebouwd met ROS2 en Python. Hij rijdt rond, danst salsa, speelt muziek, praat en luistert, schenkt bier en schiet op commando M&M's uit een minigun.",
    fr: "Un robot de fête autonome construit avec ROS2 et Python. Il se déplace, danse la salsa, joue de la musique, parle et écoute, sert de la bière et tire des M&M's avec un mini-gun sur commande.",
    es: "Un robot de fiesta autónomo hecho con ROS2 y Python. Se mueve solo, baila salsa, pone música, habla y escucha, sirve cerveza y dispara M&M's con una minigun cuando se lo pides.",
    pt: "Um robô de festa autônomo feito com ROS2 e Python. Anda sozinho, dança salsa, toca música, fala e escuta, serve cerveja e dispara M&M's de uma minigun sob comando.",
    de: "Ein autonomer Party-Roboter, gebaut mit ROS2 und Python. Er fährt herum, tanzt Salsa, spielt Musik, redet und hört zu, schenkt Bier aus und schießt auf Befehl M&M's aus einer Minigun.",
    zh: "一个用 ROS2 和 Python 打造的自主派对机器人。它会四处移动、跳萨尔萨舞、放音乐、说话和聆听、倒啤酒，还能按指令用迷你机枪发射 M&M 巧克力豆。",
  },
  "sq.pc.note": {
    en: "No code link: it was held together by vibes. Clips live in the highlight stories of",
    nl: "Geen link naar de code: die hing aan elkaar met vibes. Clips staan in de highlight stories van",
    fr: "Pas de lien vers le code : il tenait avec des vibes. Les clips sont dans les stories à la une de",
    es: "Sin enlace al código: se sostenía a base de vibes. Los clips están en las historias destacadas de",
    pt: "Sem link para o código: era mantido por vibes. Os clipes estão nos destaques dos stories de",
    de: "Kein Link zum Code: der hielt nur durch Vibes. Clips gibt es in den Story-Highlights von",
    zh: "没有代码链接：它全靠氛围撑着。片段在这个账号的精选快拍里：",
  },

  "now.title": { en: "Now", nl: "Nu", fr: "Maintenant", es: "Ahora", pt: "Agora", de: "Jetzt", zh: "现在" },
  "now.sub": {
    en: "What I'm focused on right now.",
    nl: "Waar ik nu mee bezig ben.",
    fr: "Ce sur quoi je me concentre en ce moment.",
    es: "En qué estoy centrado ahora mismo.",
    pt: "No que estou focado agora.",
    de: "Worauf ich mich gerade konzentriere.",
    zh: "我最近在专注的事。",
  },
  "now.1": { en: "GTM maxxing for Pidgy", nl: "GTM maxxing voor Pidgy", fr: "GTM maxxing pour Pidgy", es: "GTM maxxing para Pidgy", pt: "GTM maxxing para a Pidgy", de: "GTM maxxing für Pidgy", zh: "为 Pidgy 全力做 GTM" },
  "now.2": {
    en: "Social media engineering maxxing on all platforms with Compound.mov",
    nl: "Social media engineering maxxing op alle platformen met Compound.mov",
    fr: "Social media engineering maxxing sur toutes les plateformes avec Compound.mov",
    es: "Social media engineering maxxing en todas las plataformas con Compound.mov",
    pt: "Social media engineering maxxing em todas as plataformas com a Compound.mov",
    de: "Social media engineering maxxing auf allen Plattformen mit Compound.mov",
    zh: "和 Compound.mov 一起在所有平台全力做社交媒体工程",
  },
  "now.3": { en: "Chinese maxxing", nl: "Chinees maxxing", fr: "Chinois maxxing", es: "Chino maxxing", pt: "Chinês maxxing", de: "Chinesisch maxxing", zh: "全力学中文" },
  "now.4": {
    en: "Jiu-jitsu maxxing for competitions",
    nl: "Jiu-jitsu maxxing voor wedstrijden",
    fr: "Jiu-jitsu maxxing pour les compétitions",
    es: "Jiu-jitsu maxxing para competiciones",
    pt: "Jiu-jitsu maxxing para campeonatos",
    de: "Jiu-Jitsu maxxing für Wettkämpfe",
    zh: "为比赛全力练柔术",
  },
  "now.5": { en: "Hackathon soon 👀", nl: "Binnenkort hackathon 👀", fr: "Hackathon bientôt 👀", es: "Hackathon pronto 👀", pt: "Hackathon em breve 👀", de: "Bald Hackathon 👀", zh: "黑客松快来了 👀" },
  "now.updated": { en: "updated November 2026", nl: "bijgewerkt november 2026", fr: "mis à jour novembre 2026", es: "actualizado noviembre 2026", pt: "atualizado novembro 2026", de: "aktualisiert November 2026", zh: "更新于 2026 年 11 月" },
  "nav.support": { en: "support", nl: "support", fr: "soutien", es: "apoyo", pt: "apoio", de: "support", zh: "支持" },
  "location.label": { en: "📍 currently in:", nl: "📍 nu in:", fr: "📍 actuellement à :", es: "📍 ahora en:", pt: "📍 agora em:", de: "📍 gerade in:", zh: "📍 目前在：" },
  "term.hint": { en: "press any key", nl: "druk op een toets", fr: "appuie sur une touche", es: "pulsa cualquier tecla", pt: "aperte qualquer tecla", de: "drück eine Taste", zh: "按任意键" },
  "now.intro": {
    en: "Five points. Every week. Four of them aren't going anywhere: GTM, social media, jiu-jitsu, Chinese. The only real question is which sidequest gets slot five.",
    nl: "Vijf punten. Elke week. Vier ervan gaan nergens heen: GTM, social media, jiu-jitsu, Chinees. De enige echte vraag is welke sidequest plek vijf krijgt.",
    fr: "Cinq points. Chaque semaine. Quatre ne bougent pas : GTM, réseaux sociaux, jiu-jitsu, chinois. La seule vraie question : quelle quête annexe prend la cinquième place.",
    es: "Cinco puntos. Cada semana. Cuatro no se mueven: GTM, redes sociales, jiu-jitsu, chino. La única pregunta real es qué misión secundaria ocupa el quinto puesto.",
    pt: "Cinco pontos. Toda semana. Quatro não saem do lugar: GTM, redes sociais, jiu-jitsu, chinês. A única pergunta real é qual missão secundária fica com o quinto lugar.",
    de: "Fünf Punkte. Jede Woche. Vier davon bleiben: GTM, Social Media, Jiu-Jitsu, Chinesisch. Die einzige echte Frage ist, welche Nebenquest Platz fünf bekommt.",
    zh: "每周五件事。其中四件不会变：GTM、社交媒体、柔术、中文。真正的问题只有一个：第五个位置给哪个支线任务。",
  },
  "now.weekly": { en: "this week's sidequest:", nl: "sidequest van deze week:", fr: "quête annexe de la semaine :", es: "misión secundaria de esta semana:", pt: "missão secundária da semana:", de: "Nebenquest dieser Woche:", zh: "本周支线任务：" },

  "support.title": { en: "Support", nl: "Support", fr: "Soutien", es: "Apoyo", pt: "Apoio", de: "Support", zh: "支持" },
  "support.sub": {
    en: "People, companies and ideas I'd vouch for.",
    nl: "Mensen, bedrijven en ideeën waar ik voor insta.",
    fr: "Des gens, des entreprises et des idées dont je me porte garant.",
    es: "Personas, empresas e ideas por las que respondo.",
    pt: "Pessoas, empresas e ideias pelas quais eu respondo.",
    de: "Menschen, Firmen und Ideen, für die ich bürge.",
    zh: "我愿意为之担保的人、公司和想法。",
  },
  "support.people": { en: "people", nl: "mensen", fr: "personnes", es: "personas", pt: "pessoas", de: "Menschen", zh: "人" },
  "support.founders": { en: "founders", nl: "founders", fr: "fondateurs", es: "fundadores", pt: "fundadores", de: "Gründer", zh: "创始人" },
  "support.companies": { en: "companies", nl: "bedrijven", fr: "entreprises", es: "empresas", pt: "empresas", de: "Firmen", zh: "公司" },
  "support.books": { en: "books", nl: "boeken", fr: "livres", es: "libros", pt: "livros", de: "Bücher", zh: "书" },
  "support.philosophists": { en: "philosophists", nl: "filosofen", fr: "philosophes", es: "filósofos", pt: "filósofos", de: "Philosophen", zh: "哲学家" },
  "support.sport": { en: "sport people", nl: "sporters", fr: "sportifs", es: "deportistas", pt: "atletas", de: "Sportler", zh: "运动员" },
  "support.back": { en: "← support", nl: "← support", fr: "← soutien", es: "← apoyo", pt: "← apoio", de: "← support", zh: "← 支持" },

  "books.wip": { en: "WIP. More soon.", nl: "WIP. Binnenkort meer.", fr: "WIP. La suite bientôt.", es: "WIP. Pronto más.", pt: "WIP. Mais em breve.", de: "WIP. Bald mehr.", zh: "进行中，敬请期待。" },
  "books.locked": {
    en: "Inner circle only. Access is granted, not requested.",
    nl: "Alleen voor de inner circle. Toegang krijg je, die vraag je niet.",
    fr: "Réservé au cercle restreint. L'accès s'accorde, il ne se demande pas.",
    es: "Solo para el círculo cercano. El acceso se concede, no se pide.",
    pt: "Só para o círculo íntimo. O acesso é concedido, não pedido.",
    de: "Nur für den inneren Kreis. Zugang wird gewährt, nicht erfragt.",
    zh: "仅限核心圈子。权限只会被授予，不能申请。",
  },

  "phil.no1": { en: "no. 1, no discussion.", nl: "nr. 1, geen discussie.", fr: "n° 1, sans discussion.", es: "n.º 1, sin discusión.", pt: "n.º 1, sem discussão.", de: "Nr. 1, keine Diskussion.", zh: "第一名，没得商量。" },
  "phil.alexander": {
    en: "Alexander the Great: “If I were not Alexander, I would want to be Diogenes.”",
    nl: "Alexander de Grote: “Als ik Alexander niet was, zou ik Diogenes willen zijn.”",
    fr: "Alexandre le Grand : « Si je n'étais pas Alexandre, je voudrais être Diogène. »",
    es: "Alejandro Magno: «Si no fuera Alejandro, querría ser Diógenes.»",
    pt: "Alexandre, o Grande: “Se eu não fosse Alexandre, gostaria de ser Diógenes.”",
    de: "Alexander der Große: „Wäre ich nicht Alexander, wollte ich Diogenes sein.“",
    zh: "亚历山大大帝：“如果我不是亚历山大，我愿做第欧根尼。”",
  },
  "phil.diogenes": {
    en: "Diogenes: “Stand a little out of my sun.”",
    nl: "Diogenes: “Ga eens een beetje uit mijn zon.”",
    fr: "Diogène : « Ôte-toi de mon soleil. »",
    es: "Diógenes: «Apártate, que me quitas el sol.»",
    pt: "Diógenes: “Sai da frente do meu sol.”",
    de: "Diogenes: „Geh mir ein wenig aus der Sonne.“",
    zh: "第欧根尼：“请别挡住我的阳光。”",
  },
  "phil.me": { en: "me. still carrying the lantern.", nl: "ik. draag de lantaarn nog altijd.", fr: "moi. je porte toujours la lanterne.", es: "yo. todavía llevo la linterna.", pt: "eu. ainda carrego a lanterna.", de: "ich. trage die Laterne immer noch.", zh: "我，依然提着那盏灯。" },
  "books.request": { en: "request access", nl: "toegang aanvragen", fr: "demander l'accès", es: "solicitar acceso", pt: "pedir acesso", de: "Zugang anfragen", zh: "申请权限" },
  "books.sent": { en: "Request received. Don't call us, we'll call you.", nl: "Aanvraag ontvangen. Bel ons niet, wij bellen jou.", fr: "Demande reçue. Ne nous appelle pas, on t'appellera.", es: "Solicitud recibida. No nos llames, nosotros te llamamos.", pt: "Pedido recebido. Não ligue pra gente, a gente liga pra você.", de: "Anfrage erhalten. Ruf uns nicht an, wir rufen dich an.", zh: "已收到申请。不用联系我们，我们会联系你。" },
  "home.book": { en: "book a free 15-min call", nl: "boek een gratis call van 15 min", fr: "réserve un appel gratuit de 15 min", es: "reserva una llamada gratis de 15 min", pt: "agende uma call grátis de 15 min", de: "buch einen kostenlosen 15-Min-Call", zh: "预约免费 15 分钟通话" },
  "home.coffee": { en: "buy me a coffee", nl: "trakteer me op een koffie", fr: "offre-moi un café", es: "invítame a un café", pt: "me paga um café", de: "spendier mir einen Kaffee", zh: "请我喝杯咖啡" },
  "home.call60": { en: "60+ min call: you buy me a coffee", nl: "call van 60+ min: jij trakteert op koffie", fr: "appel de 60+ min : tu m'offres un café", es: "llamada de 60+ min: tú me invitas a un café", pt: "call de 60+ min: você me paga um café", de: "60+-Min-Call: du spendierst mir einen Kaffee", zh: "60 分钟以上通话：你请我喝咖啡" },
  "home.broke": { en: "broke GTM entrepreneur, always looking for opportunities.", nl: "blutte GTM-ondernemer, altijd op zoek naar kansen.", fr: "entrepreneur GTM fauché, toujours à l'affût d'opportunités.", es: "emprendedor GTM sin blanca, siempre buscando oportunidades.", pt: "empreendedor GTM duro, sempre atrás de oportunidades.", de: "pleiter GTM-Unternehmer, immer auf der Suche nach Chancen.", zh: "穷困的 GTM 创业者，永远在找机会。" },
  "home.tagline": { en: "still looking for an honest man.", nl: "nog altijd op zoek naar een eerlijke man.", fr: "toujours à la recherche d'un homme honnête.", es: "aún buscando a un hombre honesto.", pt: "ainda procurando um homem honesto.", de: "immer noch auf der Suche nach einem ehrlichen Menschen.", zh: "仍在寻找一个诚实的人。" },
  "home.callbtn": { en: "want to call with gabe maxxer? 📞", nl: "bellen met gabe maxxer? 📞", fr: "un appel avec gabe maxxer ? 📞", es: "¿llamada con gabe maxxer? 📞", pt: "uma call com o gabe maxxer? 📞", de: "Call mit gabe maxxer? 📞", zh: "想和 gabe maxxer 通话？📞" },
  "call.title": { en: "Call", nl: "Bellen", fr: "Appel", es: "Llamada", pt: "Call", de: "Call", zh: "通话" },
  "call.who": {
    en: "broke GTM entrepreneur, upcoming business philosopher and social media engineer maxxer. always looking for opportunities.",
    nl: "blutte GTM-ondernemer, toekomstig bedrijfsfilosoof en social media engineer maxxer. altijd op zoek naar kansen.",
    fr: "entrepreneur GTM fauché, futur philosophe des affaires et social media engineer maxxer. toujours à l'affût d'opportunités.",
    es: "emprendedor GTM sin blanca, futuro filósofo de negocios y social media engineer maxxer. siempre buscando oportunidades.",
    pt: "empreendedor GTM duro, futuro filósofo de negócios e social media engineer maxxer. sempre atrás de oportunidades.",
    de: "pleiter GTM-Unternehmer, angehender Business-Philosoph und Social Media Engineer Maxxer. immer auf der Suche nach Chancen.",
    zh: "穷困的 GTM 创业者，未来的商业哲学家，社交媒体工程狂人。永远在找机会。",
  },
  "call.longer": { en: "want a longer call?", nl: "liever een langere call?", fr: "envie d'un appel plus long ?", es: "¿quieres una llamada más larga?", pt: "quer uma call mais longa?", de: "lieber einen längeren Call?", zh: "想聊更久？" },
  "term.close": { en: "esc or click outside to close", nl: "esc of klik ernaast om te sluiten", fr: "échap ou clique à côté pour fermer", es: "esc o haz clic fuera para cerrar", pt: "esc ou clique fora para fechar", de: "Esc oder daneben klicken zum Schließen", zh: "按 Esc 或点击外部关闭" },
  "army.btn": { en: "join the army / flock 🐦‍🔥", nl: "join het leger / de flock 🐦‍🔥", fr: "tu veux rejoindre cette armée ?", es: "¿quieres unirte a este ejército?", pt: "quer entrar nesse exército?", de: "willst du dieser Armee beitreten?", zh: "想加入这支队伍吗？" },
  "army.text": { en: "Try to impress me in the least words possible, and I might take a look.", nl: "Probeer me te imponeren in zo weinig mogelijk woorden, en misschien kijk ik ernaar.", fr: "Essaie de m'impressionner en un minimum de mots, et j'y jetterai peut-être un œil.", es: "Intenta impresionarme con las menos palabras posibles y quizá le eche un vistazo.", pt: "Tente me impressionar com o mínimo de palavras possível, e talvez eu dê uma olhada.", de: "Versuch mich mit so wenig Worten wie möglich zu beeindrucken, dann schaue ich vielleicht rein.", zh: "用尽可能少的字打动我，我也许会看一眼。" },
  "shoutouts.more": { en: "people & companies I vouch for →", nl: "mensen & bedrijven waar ik voor insta →", fr: "les gens et entreprises que je recommande →", es: "personas y empresas por las que respondo →", pt: "pessoas e empresas que eu recomendo →", de: "Menschen & Firmen, für die ich bürge →", zh: "我担保的人和公司 →" },
  "sq.tech": { en: "(tech projects)", nl: "(tech-projecten)", fr: "(projets tech)", es: "(proyectos tech)", pt: "(projetos tech)", de: "(Tech-Projekte)", zh: "（技术项目）" },
  "sq.travel": { en: "Travel sidequests", nl: "Reis-sidequests", fr: "Quêtes annexes de voyage", es: "Misiones secundarias de viaje", pt: "Missões secundárias de viagem", de: "Reise-Nebenquests", zh: "旅行支线任务" },
  "sq.travel.desc": {
    en: "Trying to meet founders all over the world. China, Portugal, San Francisco. Soon so much more.",
    nl: "Founders proberen te ontmoeten over heel de wereld. China, Portugal, San Francisco. Binnenkort nog veel meer.",
    fr: "J'essaie de rencontrer des fondateurs partout dans le monde. Chine, Portugal, San Francisco. Bientôt bien plus.",
    es: "Intentando conocer fundadores por todo el mundo. China, Portugal, San Francisco. Pronto mucho más.",
    pt: "Tentando conhecer fundadores no mundo todo. China, Portugal, San Francisco. Em breve muito mais.",
    de: "Ich versuche, Gründer auf der ganzen Welt zu treffen. China, Portugal, San Francisco. Bald noch viel mehr.",
    zh: "在世界各地结识创始人。中国、葡萄牙、旧金山。很快会更多。",
  },
  "sq.travel.follow": { en: "follow along:", nl: "volg mee:", fr: "suis l'aventure :", es: "sígueme:", pt: "acompanhe:", de: "folge mit:", zh: "关注：" },
  "lang.title": { en: "polyglot stats", nl: "polyglot stats", fr: "polyglot stats", es: "polyglot stats", pt: "polyglot stats", de: "polyglot stats", zh: "polyglot stats" },
  "lang.sub": { en: "Seven and counting. Honest scores.", nl: "Zeven en het worden er meer. Eerlijke scores.", fr: "Sept, et ce n'est pas fini. Scores honnêtes.", es: "Siete y contando. Notas honestas.", pt: "Sete e contando. Notas honestas.", de: "Sieben und es werden mehr. Ehrliche Werte.", zh: "七种，还在增加。诚实打分。" },
  "lang.zh.note": { en: "nǐ hǎo & xièxie. fluent in 6 months. stay tuned.", nl: "nǐ hǎo & xièxie. vloeiend binnen 6 maanden. stay tuned.", fr: "nǐ hǎo & xièxie. courant dans 6 mois. restez à l'écoute.", es: "nǐ hǎo & xièxie. fluido en 6 meses. atentos.", pt: "nǐ hǎo & xièxie. fluente em 6 meses. fiquem ligados.", de: "nǐ hǎo & xièxie. fließend in 6 Monaten. stay tuned.", zh: "你好 & 谢谢。六个月内流利。敬请期待。" },
  "home.evolving": { en: "this website is constantly evolving. peek again whenever you have time.", nl: "deze website evolueert constant. kom gerust nog eens piepen.", fr: "ce site évolue sans cesse. reviens jeter un œil quand tu as le temps.", es: "esta web evoluciona constantemente. vuelve a echar un vistazo cuando tengas tiempo.", pt: "este site está sempre evoluindo. volte para espiar quando tiver tempo.", de: "diese Website entwickelt sich ständig weiter. schau einfach wieder rein.", zh: "这个网站在不断进化。有空随时回来看看。" },
  "sug.q": { en: "Which language should I learn next?", nl: "Welke taal moet ik hierna leren?", fr: "Quelle langue devrais-je apprendre ensuite ?", es: "¿Qué idioma debería aprender ahora?", pt: "Qual idioma devo aprender a seguir?", de: "Welche Sprache soll ich als Nächstes lernen?", zh: "我下一门该学什么语言？" },
  "sug.pick": { en: "pick one", nl: "kies er een", fr: "choisis", es: "elige uno", pt: "escolha um", de: "wähl eine", zh: "选一个" },
  "sug.why": { en: "why? (convince me in one line)", nl: "waarom? (overtuig me in één zin)", fr: "pourquoi ? (convaincs-moi en une ligne)", es: "¿por qué? (convénceme en una línea)", pt: "por quê? (me convença em uma linha)", de: "warum? (überzeug mich in einem Satz)", zh: "为什么？（一句话说服我）" },
  "sug.send": { en: "send", nl: "verstuur", fr: "envoyer", es: "enviar", pt: "enviar", de: "senden", zh: "发送" },
  "sug.thanks": { en: "Noted. The polyglot thanks you.", nl: "Genoteerd. De polyglot bedankt je.", fr: "Noté. Le polyglotte te remercie.", es: "Anotado. El políglota te lo agradece.", pt: "Anotado. O poliglota agradece.", de: "Notiert. Der Polyglott dankt dir.", zh: "已记下。多语者谢谢你。" },
  "sug.other": { en: "other", nl: "andere", fr: "autre", es: "otro", pt: "outro", de: "andere", zh: "其他" },
};

function savedLang() {
  try { return localStorage.getItem("lang"); } catch { return null; }
}

export function getLang() {
  const codes = LANGS.map(l => l[0]);
  const q = new URLSearchParams(location.search).get("lang");
  if (codes.includes(q)) return q;
  const s = savedLang();
  if (codes.includes(s)) return s;
  const nav = (navigator.language || "en").slice(0, 2).toLowerCase();
  return codes.includes(nav) ? nav : "en";
}

export function t(key, lang = getLang()) {
  const entry = STRINGS[key];
  if (!entry) return key;
  return entry[lang] ?? entry.en;
}

// Pick the right language from a {en, nl, ...} object or return a plain string
export function pick(value, lang = getLang()) {
  if (value && typeof value === "object") return value[lang] ?? value.en;
  return value;
}

export function applyI18n(lang = getLang()) {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.dataset.i18n, lang);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder, lang);
  });
}

export function renderSwitcher(onChange) {
  const box = document.getElementById("lang-switcher");
  if (!box) return;
  const current = getLang();
  box.innerHTML = "";
  LANGS.forEach(([code, label]) => {
    const a = document.createElement("a");
    a.href = "#";
    a.textContent = label;
    if (code === current) a.className = "active";
    a.addEventListener("click", e => {
      e.preventDefault();
      try { localStorage.setItem("lang", code); } catch {}
      const url = new URL(location.href);
      url.searchParams.set("lang", code);
      history.replaceState(null, "", url);
      applyI18n(code);
      renderSwitcher(onChange);
      if (onChange) onChange(code);
    });
    box.appendChild(a);
  });
  const stats = document.createElement("a");
  stats.href = "/languages/";
  stats.className = "stats";
  stats.textContent = "· " + t("lang.title");
  box.appendChild(stats);
}

function renderCornerNav() {
  if (document.getElementById("corner-nav")) return;
  const nav = document.createElement("div");
  nav.id = "corner-nav";
  nav.className = "corner-nav";
  renderSearch(nav);
  if (location.pathname === "/") { document.body.appendChild(nav); return; }
  const back = document.createElement("a");
  back.href = "#"; back.textContent = "←"; back.title = "back"; back.setAttribute("aria-label", "back");
  back.addEventListener("click", e => {
    e.preventDefault();
    if (history.length > 1 && document.referrer.startsWith(location.origin)) history.back();
    else location.href = "/";
  });
  const home = document.createElement("a");
  home.href = "/"; home.textContent = "⌂"; home.title = "home"; home.setAttribute("aria-label", "home");
  nav.append(back, home);
  document.body.appendChild(nav);
}

export function initI18n(onChange) {
  applyI18n();
  renderSwitcher(onChange);
  renderCornerNav();
}

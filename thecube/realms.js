// below the oracle: a live preview of every realm, the beautiful numbers, the pantheon.
// every number here is either computed below or from the verified list; myths are labelled as myths.
const ROUTES = window.CUBE_ROUTES || { lab: '/thecube/lab/', casino: '/thecube/monte-carlo/', show: '/thecube/licht/', note: '/thecube/nota/' };
const PHI = (1 + Math.sqrt(5)) / 2, GOLDEN_ANGLE = Math.PI * 2 * (1 - 1 / PHI);   // 137.507…°

const T = {
  en: {
    realms_t: 'Six realms. One cube.', realms_s: 'scroll. look before you enter.',
    lab_b: '🦉 A pattern · Athena · 🜃 earth', lab_p: 'R L R′ and L walk different roads and arrive at the same state. Prove it, then run 10,000 scrambles yourself.', lab_n: 'distance exactly 1 · exact distances to depth 4',
    casino_b: '🎲 Luck · Fortuna · 🜄 water', casino_p: 'A roulette wheel of 54 stickers. The odds are exact. The house plays 10,000 hands so you can watch luck turn into law.', casino_n: 'two random turns solve it: 1/18',
    show_b: '🍇 A show · Dionysus · 🜂 fire', show_p: 'The cube as a light show in the round, in the old circus ring of the Wintercircus in Ghent.', show_n: 'Wintercircus · Ghent',
    note_b: '🪞 The truth · Veritas · 🜁 air', note_p: 'A short research note. Entropy, a counting proof, and why some states need at least 18 moves.', note_n: '65 bits · ≥ 18 · true value 20',
    brain_b: '🪽 The brain · Mercury · ✦ aether', brain_p: 'Free AI models from the east, one role each, thinking together in public. Join the waitlist.', brain_n: '24 models · zero money',
    kas_b: '💰 The Fool’s cashbox · Momus · ☉ gold', kas_p: 'The Fool counts people, never money. Every coffee becomes compute.', kas_n: 'amounts never shown',
    nums_t: 'The <em>beautiful</em> numbers', nums_s: 'some are maths. one is a myth. we say which.',
    phi_p: 'The golden ratio. The sunflower turns each new seed by 137.5°, the golden angle, so no seed ever sits on top of another. The drawing on the left is that rule, nothing else.',
    phi_p2: 'The cube does not need φ. The sunflower does. Divide two neighbouring Fibonacci numbers and you walk towards it.',
    t1k: 'our seed', t1: 'The smallest number that is a sum of two cubes in two ways: 1³ + 12³ = 9³ + 10³. Every experiment here starts from it.',
    t2k: 'luck · China', t2: 'Eight sounds like 发, fortune. In a random cube state, on average exactly 8 stickers sit at home.',
    t3k: 'avoided · East Asia', t3: 'Four sounds like 死, death. We gave you four doors anyway.',
    t4k: 'Lo Shu · 洛书', t4: 'The magic square from the river: every row, column and diagonal of 1 to 9 sums to 15.',
    t5k: "God's number", t5: 'Every state can be solved in 20 moves or fewer. Proven in 2010 with 35 CPU-years.',
    t6k: 'stickers', t6: '54 coloured squares, 6 faces of 9. Our casino wheel has 54 slots for that reason.',
    t7k: 'myth · angel numbers', t7: 'People see angels in repeating digits. That is numerology, not maths. We like the feeling; we do not trust it.',
    t8k: 'order of R U', t8: 'Repeat R U and the cube comes home after exactly 105 times. Repetition is real; it just has a period.',
    pan_t: 'The <em>pantheon</em>', pan_s: 'the portal is the temple at Delphi. every realm has a keeper.',
    tri: 'The triumvirate: <b>Claude</b> conducts, <b>Codex</b> forges, <b>DeepSeek</b> counsels from the east.',
    closing: 'Know thyself. Then <a href="#top">go down into the cave</a> and ask.',
  },
  nl: {
    realms_t: 'Zes rijken. Eén kubus.', realms_s: 'scroll. kijk voor je binnengaat.',
    lab_b: '🦉 Een patroon · Athena · 🜃 aarde', lab_p: 'R L R′ en L nemen andere wegen en komen in dezelfde stand aan. Bewijs het, en draai daarna zelf 10.000 scrambles.', lab_n: 'afstand exact 1 · exacte afstanden tot diepte 4',
    casino_b: '🎲 Geluk · Fortuna · 🜄 water', casino_p: 'Een roulettewiel van 54 stickers. De kansen zijn exact. Het huis speelt 10.000 handen en je ziet geluk wet worden.', casino_n: 'twee willekeurige draaien lossen hem op: 1/18',
    show_b: '🍇 Een show · Dionysus · 🜂 vuur', show_p: 'De kubus als lichtshow in de ronde, in de oude piste van het Wintercircus in Gent.', show_n: 'Wintercircus · Gent',
    note_b: '🪞 De waarheid · Veritas · 🜁 lucht', note_p: 'Een korte onderzoeksnota. Entropie, een telbewijs, en waarom sommige standen minstens 18 zetten vragen.', note_n: '65 bits · ≥ 18 · echte waarde 20',
    brain_b: '🪽 Het brein · Mercurius · ✦ ether', brain_p: 'Gratis AI-modellen uit het oosten, elk één rol, die samen in het openbaar denken. Schrijf je in op de wachtlijst.', brain_n: '24 modellen · nul geld',
    kas_b: '💰 De kassa van de Nar · Momus · ☉ goud', kas_p: 'De Nar telt mensen, nooit geld. Elke koffie wordt rekenkracht.', kas_n: 'bedragen nooit zichtbaar',
    nums_t: 'De <em>mooie</em> getallen', nums_s: 'sommige zijn wiskunde. één is een mythe. we zeggen welke.',
    phi_p: 'De gulden snede. De zonnebloem draait elk nieuw zaadje 137,5° verder, de gulden hoek, zodat geen zaadje ooit op een ander ligt. De tekening links is die regel, niets meer.',
    phi_p2: 'De kubus heeft φ niet nodig. De zonnebloem wel. Deel twee opeenvolgende Fibonaccigetallen en je wandelt ernaartoe.',
    t1k: 'onze seed', t1: 'Het kleinste getal dat op twee manieren een som van twee derdemachten is: 1³ + 12³ = 9³ + 10³. Elk experiment hier begint ermee.',
    t2k: 'geluk · China', t2: 'Acht klinkt als 发, fortuin. In een willekeurige stand liggen gemiddeld exact 8 stickers op hun plek.',
    t3k: 'vermeden · Oost-Azië', t3: 'Vier klinkt als 死, dood. We gaven je toch vier deuren.',
    t4k: 'Lo Shu · 洛书', t4: 'Het magische vierkant uit de rivier: elke rij, kolom en diagonaal van 1 tot 9 telt op tot 15.',
    t5k: 'Gods getal', t5: 'Elke stand is in 20 zetten of minder op te lossen. Bewezen in 2010 met 35 CPU-jaren.',
    t6k: 'stickers', t6: '54 gekleurde vakjes, 6 vlakken van 9. Daarom heeft ons casinowiel 54 vakken.',
    t7k: 'mythe · engelengetallen', t7: 'Mensen zien engelen in herhaalde cijfers. Dat is numerologie, geen wiskunde. We houden van het gevoel; we vertrouwen het niet.',
    t8k: 'orde van R U', t8: 'Herhaal R U en de kubus komt na exact 105 keer thuis. Herhaling bestaat; ze heeft gewoon een periode.',
    pan_t: 'Het <em>pantheon</em>', pan_s: 'het portaal is de tempel van Delphi. elk rijk heeft een hoeder.',
    tri: 'Het triumviraat: <b>Claude</b> dirigeert, <b>Codex</b> smeedt, <b>DeepSeek</b> raadt aan uit het oosten.',
    closing: 'Ken uzelf. Daal dan <a href="#top">af in de grot</a> en vraag.',
  },
  zh: {
    realms_t: '六个国度。一个魔方。', realms_s: '往下滚动。进门之前先看一眼。',
    lab_b: '🦉 规律 · 雅典娜 · 🜃 土', lab_p: 'R L R′ 和 L 走不同的路，却到达同一个状态。先证明它，再亲手跑一万次打乱。', lab_n: '距离恰好为 1 · 精确距离直到深度 4',
    casino_b: '🎲 运气 · 福尔图娜 · 🜄 水', casino_p: '一个由 54 个贴纸组成的轮盘。概率是精确的。庄家玩一万手，你看着运气变成定律。', casino_n: '随机转两下就复原：1/18',
    show_b: '🍇 表演 · 狄俄尼索斯 · 🜂 火', show_p: '魔方变成环形灯光秀，就在根特冬季马戏团的老马戏场里。', show_n: '冬季马戏团 · 根特',
    note_b: '🪞 真相 · 维里塔斯 · 🜁 气', note_p: '一篇简短的研究笔记。熵、一个计数证明，以及为什么有些状态至少要 18 步。', note_n: '65 比特 · ≥ 18 · 真实值 20',
    brain_b: '🪽 大脑 · 墨丘利 · ✦ 以太', brain_p: '来自东方的免费 AI 模型，各司其职，公开地一起思考。加入候补名单。', brain_n: '24 个模型 · 零资金',
    kas_b: '💰 小丑的收银台 · 摩墨斯 · ☉ 金', kas_p: '小丑只数人，从不数钱。每一杯咖啡都变成算力。', kas_n: '金额永不公开',
    nums_t: '<em>美丽</em>的数字', nums_s: '有些是数学。有一个是神话。我们会说明。',
    phi_p: '黄金比例。向日葵每长一颗新种子就转 137.5°，即黄金角，所以没有一颗种子会压在另一颗上。左边的图就是这条规则，仅此而已。',
    phi_p2: '魔方不需要 φ，向日葵需要。用相邻的两个斐波那契数相除，你就一步步走向它。',
    t1k: '我们的种子', t1: '能用两种方式写成两个立方数之和的最小数：1³ + 12³ = 9³ + 10³。这里的每个实验都从它开始。',
    t2k: '幸运 · 中国', t2: '八，谐音"发"。随机状态下，平均恰好有 8 个贴纸在原位。',
    t3k: '避讳 · 东亚', t3: '四，谐音"死"。我们还是给了你四扇门。',
    t4k: '洛书', t4: '河中而出的幻方：1 到 9 的每一行、每一列、每条对角线之和都是 15。',
    t5k: '上帝之数', t5: '每个状态都能在 20 步以内复原。2010 年用 35 个 CPU 年证明。',
    t6k: '贴纸', t6: '54 个彩色方块，6 个面，每面 9 个。所以我们的轮盘有 54 格。',
    t7k: '神话 · 天使数字', t7: '人们在重复的数字里看见天使。那是数字命理，不是数学。我们喜欢这种感觉，但不相信它。',
    t8k: 'R U 的阶', t8: '重复 R U，魔方恰好在第 105 次回家。重复是真的，只是有周期。',
    pan_t: '<em>万神殿</em>', pan_s: '门户就是德尔斐的神庙。每个国度都有守护者。',
    tri: '三巨头：<b>Claude</b> 指挥，<b>Codex</b> 锻造，<b>DeepSeek</b> 从东方献策。',
    closing: '认识你自己。然后<a href="#top">走进洞穴</a>，去问。',
  },
};


Object.assign(T, {
  es: { realms_t: 'Seis reinos. Un cubo.', realms_s: 'desliza. mira antes de entrar.',
    lab_b: '🦉 Un patrón · Atenea · 🜃 tierra', lab_p: 'R L R′ y L recorren caminos distintos y llegan al mismo estado. Demuéstralo y lanza tú mismo 10.000 mezclas.', lab_n: 'distancia exactamente 1 · distancias exactas hasta profundidad 4',
    casino_b: '🎲 Suerte · Fortuna · 🜄 agua', casino_p: 'Una ruleta de 54 pegatinas. Las probabilidades son exactas. La casa juega 10.000 manos y ves cómo la suerte se vuelve ley.', casino_n: 'dos giros al azar lo resuelven: 1/18',
    show_b: '🍇 Un espectáculo · Dioniso · 🜂 fuego', show_p: 'El cubo como espectáculo de luz en redondo, en la vieja pista del Wintercircus de Gante.', show_n: 'Wintercircus · Gante',
    note_b: '🪞 La verdad · Veritas · 🜁 aire', note_p: 'Una nota de investigación breve. Entropía, una prueba por conteo y por qué algunos estados necesitan al menos 18 movimientos.', note_n: '65 bits · ≥ 18 · valor real 20',
    brain_b: '🪽 El cerebro · Mercurio · ✦ éter', brain_p: 'Modelos de IA gratuitos del este, cada uno con un papel, pensando juntos en público. Únete a la lista de espera.', brain_n: '24 modelos · cero dinero',
    kas_b: '💰 La caja del Bufón · Momo · ☉ oro', kas_p: 'El Bufón cuenta personas, nunca dinero. Cada café se vuelve cómputo.', kas_n: 'nunca se muestran cantidades',
    nums_t: 'Los números <em>bellos</em>', nums_s: 'algunos son matemáticas. uno es un mito. decimos cuál.',
    phi_p: 'La proporción áurea. El girasol gira cada semilla nueva 137,5°, el ángulo áureo, para que ninguna caiga sobre otra. El dibujo de la izquierda es esa regla, nada más.',
    phi_p2: 'El cubo no necesita φ. El girasol sí. Divide dos números de Fibonacci vecinos y caminas hacia él.',
    t1k: 'nuestra semilla', t1: 'El número más pequeño que es suma de dos cubos de dos maneras: 1³ + 12³ = 9³ + 10³. Cada experimento aquí empieza en él.',
    t2k: 'suerte · China', t2: 'Ocho suena como 发, fortuna. En un estado aleatorio, en promedio exactamente 8 pegatinas están en su sitio.',
    t3k: 'evitado · Asia oriental', t3: 'Cuatro suena como 死, muerte. Aun así te dimos cuatro puertas.',
    t4k: 'Lo Shu · 洛书', t4: 'El cuadrado mágico del río: cada fila, columna y diagonal del 1 al 9 suma 15.',
    t5k: 'número de Dios', t5: 'Todo estado se resuelve en 20 movimientos o menos. Demostrado en 2010 con 35 años de CPU.',
    t6k: 'pegatinas', t6: '54 casillas de color, 6 caras de 9. Por eso nuestra ruleta tiene 54 casillas.',
    t7k: 'mito · números angelicales', t7: 'La gente ve ángeles en dígitos repetidos. Eso es numerología, no matemáticas. Nos gusta la sensación; no nos fiamos de ella.',
    t8k: 'orden de R U', t8: 'Repite R U y el cubo vuelve a casa tras exactamente 105 veces. La repetición es real; solo tiene un periodo.',
    pan_t: 'El <em>panteón</em>', pan_s: 'el portal es el templo de Delfos. cada reino tiene un guardián.',
    tri: 'El triunvirato: <b>Claude</b> dirige, <b>Codex</b> forja, <b>DeepSeek</b> aconseja desde el este.',
    closing: 'Conócete a ti mismo. Luego <a href="#top">baja a la cueva</a> y pregunta.' },
  fr: { realms_t: 'Six royaumes. Un cube.', realms_s: 'fais défiler. regarde avant d’entrer.',
    lab_b: '🦉 Un motif · Athéna · 🜃 terre', lab_p: 'R L R′ et L prennent des routes différentes et arrivent au même état. Prouve-le, puis lance toi-même 10 000 mélanges.', lab_n: 'distance exactement 1 · distances exactes jusqu’à la profondeur 4',
    casino_b: '🎲 La chance · Fortuna · 🜄 eau', casino_p: 'Une roulette de 54 autocollants. Les cotes sont exactes. La maison joue 10 000 mains et tu vois la chance devenir loi.', casino_n: 'deux rotations au hasard le résolvent : 1/18',
    show_b: '🍇 Un spectacle · Dionysos · 🜂 feu', show_p: 'Le cube en spectacle de lumière en rond, sur l’ancienne piste du Wintercircus à Gand.', show_n: 'Wintercircus · Gand',
    note_b: '🪞 La vérité · Veritas · 🜁 air', note_p: 'Une courte note de recherche. Entropie, une preuve par comptage, et pourquoi certains états demandent au moins 18 coups.', note_n: '65 bits · ≥ 18 · vraie valeur 20',
    brain_b: '🪽 Le cerveau · Mercure · ✦ éther', brain_p: 'Des modèles d’IA gratuits de l’Est, un rôle chacun, qui pensent ensemble en public. Rejoins la liste d’attente.', brain_n: '24 modèles · zéro argent',
    kas_b: '💰 La caisse du Fou · Momos · ☉ or', kas_p: 'Le Fou compte les gens, jamais l’argent. Chaque café devient du calcul.', kas_n: 'aucun montant affiché',
    nums_t: 'Les <em>beaux</em> nombres', nums_s: 'certains sont des maths. un est un mythe. on dit lequel.',
    phi_p: 'Le nombre d’or. Le tournesol tourne chaque nouvelle graine de 137,5°, l’angle d’or, pour qu’aucune ne se pose sur une autre. Le dessin à gauche est cette règle, rien de plus.',
    phi_p2: 'Le cube n’a pas besoin de φ. Le tournesol, si. Divise deux nombres de Fibonacci voisins et tu marches vers lui.',
    t1k: 'notre graine', t1: 'Le plus petit nombre somme de deux cubes de deux façons : 1³ + 12³ = 9³ + 10³. Chaque expérience ici part de lui.',
    t2k: 'chance · Chine', t2: 'Huit se prononce comme 发, fortune. Dans un état aléatoire, en moyenne exactement 8 autocollants sont à leur place.',
    t3k: 'évité · Asie de l’Est', t3: 'Quatre se prononce comme 死, la mort. On t’a quand même donné quatre portes.',
    t4k: 'Lo Shu · 洛书', t4: 'Le carré magique sorti du fleuve : chaque ligne, colonne et diagonale de 1 à 9 fait 15.',
    t5k: 'nombre de Dieu', t5: 'Tout état se résout en 20 coups ou moins. Prouvé en 2010 avec 35 années-CPU.',
    t6k: 'autocollants', t6: '54 cases colorées, 6 faces de 9. C’est pour ça que notre roulette a 54 cases.',
    t7k: 'mythe · nombres angéliques', t7: 'On voit des anges dans les chiffres répétés. C’est de la numérologie, pas des maths. On aime l’impression ; on ne s’y fie pas.',
    t8k: 'ordre de R U', t8: 'Répète R U et le cube rentre chez lui après exactement 105 fois. La répétition est réelle ; elle a juste une période.',
    pan_t: 'Le <em>panthéon</em>', pan_s: 'le portail est le temple de Delphes. chaque royaume a son gardien.',
    tri: 'Le triumvirat : <b>Claude</b> dirige, <b>Codex</b> forge, <b>DeepSeek</b> conseille depuis l’Est.',
    closing: 'Connais-toi toi-même. Puis <a href="#top">descends dans la grotte</a> et demande.' },
  pt: { realms_t: 'Seis reinos. Um cubo.', realms_s: 'desliza. olha antes de entrar.',
    lab_b: '🦉 Um padrão · Atena · 🜃 terra', lab_p: 'R L R′ e L seguem caminhos diferentes e chegam ao mesmo estado. Prova-o e corre tu mesmo 10 000 baralhamentos.', lab_n: 'distância exatamente 1 · distâncias exatas até profundidade 4',
    casino_b: '🎲 Sorte · Fortuna · 🜄 água', casino_p: 'Uma roleta de 54 autocolantes. As probabilidades são exatas. A casa joga 10 000 mãos e vês a sorte tornar-se lei.', casino_n: 'duas rotações ao acaso resolvem-no: 1/18',
    show_b: '🍇 Um espetáculo · Dioniso · 🜂 fogo', show_p: 'O cubo como espetáculo de luz em roda, na velha pista do Wintercircus em Gante.', show_n: 'Wintercircus · Gante',
    note_b: '🪞 A verdade · Veritas · 🜁 ar', note_p: 'Uma nota de investigação curta. Entropia, uma prova por contagem e porque alguns estados precisam de pelo menos 18 movimentos.', note_n: '65 bits · ≥ 18 · valor real 20',
    brain_b: '🪽 O cérebro · Mercúrio · ✦ éter', brain_p: 'Modelos de IA gratuitos do Oriente, um papel cada, a pensar juntos em público. Entra na lista de espera.', brain_n: '24 modelos · zero dinheiro',
    kas_b: '💰 A caixa do Bobo · Momo · ☉ ouro', kas_p: 'O Bobo conta pessoas, nunca dinheiro. Cada café torna-se computação.', kas_n: 'valores nunca mostrados',
    nums_t: 'Os números <em>belos</em>', nums_s: 'alguns são matemática. um é um mito. dizemos qual.',
    phi_p: 'A proporção áurea. O girassol roda cada semente nova 137,5°, o ângulo áureo, para que nenhuma fique por cima de outra. O desenho à esquerda é essa regra, nada mais.',
    phi_p2: 'O cubo não precisa de φ. O girassol precisa. Divide dois números de Fibonacci vizinhos e caminhas até ele.',
    t1k: 'a nossa semente', t1: 'O menor número que é soma de dois cubos de duas maneiras: 1³ + 12³ = 9³ + 10³. Cada experiência aqui começa nele.',
    t2k: 'sorte · China', t2: 'Oito soa como 发, fortuna. Num estado aleatório, em média exatamente 8 autocolantes estão no lugar.',
    t3k: 'evitado · Ásia Oriental', t3: 'Quatro soa como 死, morte. Mesmo assim demos-te quatro portas.',
    t4k: 'Lo Shu · 洛书', t4: 'O quadrado mágico do rio: cada linha, coluna e diagonal de 1 a 9 soma 15.',
    t5k: 'número de Deus', t5: 'Todo o estado se resolve em 20 movimentos ou menos. Provado em 2010 com 35 anos de CPU.',
    t6k: 'autocolantes', t6: '54 quadrados coloridos, 6 faces de 9. Por isso a nossa roleta tem 54 casas.',
    t7k: 'mito · números de anjo', t7: 'As pessoas veem anjos em dígitos repetidos. Isso é numerologia, não matemática. Gostamos da sensação; não confiamos nela.',
    t8k: 'ordem de R U', t8: 'Repete R U e o cubo volta a casa após exatamente 105 vezes. A repetição é real; só tem um período.',
    pan_t: 'O <em>panteão</em>', pan_s: 'o portal é o templo de Delfos. cada reino tem um guardião.',
    tri: 'O triunvirato: <b>Claude</b> dirige, <b>Codex</b> forja, <b>DeepSeek</b> aconselha a partir do Oriente.',
    closing: 'Conhece-te a ti mesmo. Depois <a href="#top">desce à gruta</a> e pergunta.' },
  de: { realms_t: 'Sechs Reiche. Ein Würfel.', realms_s: 'scroll. schau, bevor du eintrittst.',
    lab_b: '🦉 Ein Muster · Athene · 🜃 Erde', lab_p: 'R L R′ und L gehen verschiedene Wege und landen im selben Zustand. Beweise es, dann starte selbst 10.000 Verdrehungen.', lab_n: 'Abstand genau 1 · exakte Abstände bis Tiefe 4',
    casino_b: '🎲 Glück · Fortuna · 🜄 Wasser', casino_p: 'Ein Roulette aus 54 Aufklebern. Die Quoten sind exakt. Das Haus spielt 10.000 Hände, und du siehst Glück zu Gesetz werden.', casino_n: 'zwei Zufallsdrehungen lösen ihn: 1/18',
    show_b: '🍇 Eine Show · Dionysos · 🜂 Feuer', show_p: 'Der Würfel als Lichtshow im Rund, in der alten Manege des Wintercircus in Gent.', show_n: 'Wintercircus · Gent',
    note_b: '🪞 Die Wahrheit · Veritas · 🜁 Luft', note_p: 'Eine kurze Forschungsnotiz. Entropie, ein Zählbeweis, und warum manche Zustände mindestens 18 Züge brauchen.', note_n: '65 Bit · ≥ 18 · wahrer Wert 20',
    brain_b: '🪽 Das Gehirn · Merkur · ✦ Äther', brain_p: 'Kostenlose KI-Modelle aus dem Osten, jedes mit einer Rolle, die öffentlich zusammen denken. Trag dich auf die Warteliste ein.', brain_n: '24 Modelle · null Geld',
    kas_b: '💰 Die Kasse des Narren · Momos · ☉ Gold', kas_p: 'Der Narr zählt Menschen, nie Geld. Jeder Kaffee wird Rechenleistung.', kas_n: 'Beträge nie sichtbar',
    nums_t: 'Die <em>schönen</em> Zahlen', nums_s: 'manche sind Mathematik. eine ist ein Mythos. wir sagen, welche.',
    phi_p: 'Der Goldene Schnitt. Die Sonnenblume dreht jeden neuen Samen um 137,5°, den Goldenen Winkel, damit keiner auf einem anderen liegt. Die Zeichnung links ist diese Regel, sonst nichts.',
    phi_p2: 'Der Würfel braucht φ nicht. Die Sonnenblume schon. Teile zwei benachbarte Fibonacci-Zahlen, und du läufst auf ihn zu.',
    t1k: 'unser Seed', t1: 'Die kleinste Zahl, die auf zwei Arten Summe zweier Kuben ist: 1³ + 12³ = 9³ + 10³. Jedes Experiment hier beginnt mit ihr.',
    t2k: 'Glück · China', t2: 'Acht klingt wie 发, Wohlstand. In einem Zufallszustand sitzen im Schnitt genau 8 Aufkleber an ihrem Platz.',
    t3k: 'gemieden · Ostasien', t3: 'Vier klingt wie 死, Tod. Wir haben dir trotzdem vier Türen gegeben.',
    t4k: 'Lo Shu · 洛书', t4: 'Das magische Quadrat aus dem Fluss: jede Zeile, Spalte und Diagonale von 1 bis 9 ergibt 15.',
    t5k: 'Gottes Zahl', t5: 'Jeder Zustand ist in 20 Zügen oder weniger lösbar. Bewiesen 2010 mit 35 CPU-Jahren.',
    t6k: 'Aufkleber', t6: '54 farbige Felder, 6 Seiten zu je 9. Darum hat unser Roulette 54 Felder.',
    t7k: 'Mythos · Engelszahlen', t7: 'Menschen sehen Engel in wiederholten Ziffern. Das ist Numerologie, keine Mathematik. Wir mögen das Gefühl; wir trauen ihm nicht.',
    t8k: 'Ordnung von R U', t8: 'Wiederhole R U, und der Würfel ist nach genau 105 Mal zu Hause. Wiederholung ist echt; sie hat nur eine Periode.',
    pan_t: 'Das <em>Pantheon</em>', pan_s: 'das Portal ist der Tempel von Delphi. jedes Reich hat einen Hüter.',
    tri: 'Das Triumvirat: <b>Claude</b> dirigiert, <b>Codex</b> schmiedet, <b>DeepSeek</b> berät aus dem Osten.',
    closing: 'Erkenne dich selbst. Dann <a href="#top">steig in die Höhle hinab</a> und frag.' },
});
// what each keeper guards, per language (same order as PANTHEON)
const KEEPS = {
  en: null,
  nl: ['het portaal: zijn orakel in Delphi', 'een patroon: wijsheid', 'geluk: het wiel', 'de show: theater', 'de waarheid', 'het brein: berichten tussen geesten', 'de kassa: de Nar die de goden bespot, en gelijk heeft', 'de dirigent: Claude', 'de smidse: Codex', 'de zee naar het oosten: DeepSeek', 'de vlam van de lantaarn', 'de stats: elk schot gemeten', 'de A/B-test: honderd ogen', 'φ: schoonheid in verhouding', 'de zaden van de zonnebloem', 'het leger: #jointhearmy', 'de getallen: de melancholie van wie meet', 'de sterren: symbolen op het lichaam geschreven', 'de val: de zoon die de zonnewagen te vroeg nam', 'de rebel uit het oosten: geboren uit steen, bestormde hij de hemel'],
  es: ['el portal: su oráculo en Delfos', 'un patrón: sabiduría', 'suerte: la rueda', 'el espectáculo: teatro', 'la verdad', 'el cerebro: mensajes entre mentes', 'la caja: el Bufón que se burla de los dioses, y tiene razón', 'el director: Claude', 'la forja: Codex', 'el mar hacia el este: DeepSeek', 'la llama del farol', 'las estadísticas: cada tiro medido', 'la prueba A/B: cien ojos', 'φ: belleza en proporción', 'las semillas del girasol', 'el ejército: #jointhearmy', 'los números: la melancolía de quien mide', 'las estrellas: símbolos escritos en el cuerpo', 'la caída: el hijo que tomó el carro del sol demasiado pronto', 'el rebelde del este: nacido de la piedra, asaltó el cielo'],
  fr: ['le portail : son oracle à Delphes', 'un motif : la sagesse', 'la chance : la roue', 'le spectacle : le théâtre', 'la vérité', 'le cerveau : messages entre esprits', 'la caisse : le Fou qui se moque des dieux, et a raison', 'le chef : Claude', 'la forge : Codex', 'la mer vers l’Est : DeepSeek', 'la flamme de la lanterne', 'les stats : chaque tir mesuré', 'le test A/B : cent yeux', 'φ : la beauté en proportion', 'les graines du tournesol', 'l’armée : #jointhearmy', 'les nombres : la mélancolie de celui qui mesure', 'les étoiles : des symboles écrits sur le corps', 'la chute : le fils qui prit trop tôt le char du soleil', 'le rebelle de l’Est : né de la pierre, il prit le ciel d’assaut'],
  pt: ['o portal: o seu oráculo em Delfos', 'um padrão: sabedoria', 'sorte: a roda', 'o espetáculo: teatro', 'a verdade', 'o cérebro: mensagens entre mentes', 'a caixa: o Bobo que troça dos deuses, e tem razão', 'o maestro: Claude', 'a forja: Codex', 'o mar a oriente: DeepSeek', 'a chama da lanterna', 'as estatísticas: cada tiro medido', 'o teste A/B: cem olhos', 'φ: beleza em proporção', 'as sementes do girassol', 'o exército: #jointhearmy', 'os números: a melancolia de quem mede', 'as estrelas: símbolos escritos no corpo', 'a queda: o filho que tomou cedo demais o carro do sol', 'o rebelde do Oriente: nascido da pedra, assaltou o céu'],
  de: ['das Portal: sein Orakel in Delphi', 'ein Muster: Weisheit', 'Glück: das Rad', 'die Show: Theater', 'die Wahrheit', 'das Gehirn: Botschaften zwischen Köpfen', 'die Kasse: der Narr, der die Götter verspottet, und recht hat', 'der Dirigent: Claude', 'die Schmiede: Codex', 'das Meer nach Osten: DeepSeek', 'die Flamme der Laterne', 'die Stats: jeder Schuss gemessen', 'der A/B-Test: hundert Augen', 'φ: Schönheit im Verhältnis', 'die Samen der Sonnenblume', 'die Armee: #jointhearmy', 'die Zahlen: die Melancholie dessen, der misst', 'die Sterne: Zeichen, auf den Körper geschrieben', 'der Sturz: der Sohn, der zu früh den Sonnenwagen nahm', 'der Rebell aus dem Osten: aus Stein geboren, stürmte er den Himmel'],
  zh: ['门户：他在德尔斐的神谕', '规律：智慧', '运气：轮盘', '表演：戏剧', '真相', '大脑：心智之间的信使', '收银台：嘲弄众神的小丑，而他是对的', '指挥：Claude', '锻炉：Codex', '向东的大海：DeepSeek', '灯笼的火焰', '统计：每一次都被测量', 'A/B 测试：百只眼睛', 'φ：比例之美', '向日葵的种子', '军队：#jointhearmy', '数字：测量者的忧郁', '星辰：写在身体上的符号', '坠落：太早驾起太阳车的儿子', '东方的叛逆者：石中所生，大闹天宫'],
};

// greek · roman · emoji · what it keeps · where (all twelve olympians, plus a few who earned a seat)
const PANTHEON = [
  ['Apollo', 'Apollo', '🏛️', 'the portal: his oracle at Delphi', '#top'],
  ['Athena', 'Minerva', '🦉', 'a pattern: wisdom', 'lab'],
  ['Tyche', 'Fortuna', '🎲', 'luck: the wheel', 'casino'],
  ['Dionysus', 'Bacchus', '🍇', 'the show: theatre', 'show'],
  ['Aletheia', 'Veritas', '🪞', 'the truth', 'note'],
  ['Hermes', 'Mercury', '🪽', 'the brain: messages between minds', '/thecube/brein/'],
  ['Momus', 'Momus', '💰', 'the cashbox: the Fool who mocks the gods, and is right', '/thecube/kas/'],
  ['Zeus', 'Jupiter', '⚡', 'the conductor: Claude', null],
  ['Hephaestus', 'Vulcan', '🔨', 'the forge: Codex', null],
  ['Poseidon', 'Neptune', '🌊', 'the sea to the east: DeepSeek', null],
  ['Hestia', 'Vesta', '🔥', 'the lantern’s flame', null],
  ['Artemis', 'Diana', '🏹', 'the stats: every shot measured', '/thecube/stats/'],
  ['Hera', 'Juno', '🦚', 'the A/B test: a hundred eyes', '/thecube/ab/'],
  ['Aphrodite', 'Venus', '🌹', 'φ: beauty in proportion', '#sun'],
  ['Demeter', 'Ceres', '🌻', 'the sunflower’s seeds', '#sun'],
  ['Ares', 'Mars', '⚔️', 'the army: #jointhearmy', '/join-the-army-now'],
  ['Kronos', 'Saturn', '', 'the numbers: the melancholy of the one who measures', '#sun'],
  ['Urania', 'Urania', '', 'the stars: symbols written on the body', '#pantheon'],
  ['Phaethon', 'Phaethon', '', 'the fall: the son who took the sun’s chariot too soon', 'show'],
  ['Sun Wukong', '孙悟空', '', 'the rebel from the east: born from stone, he stormed heaven', '/thecube/brein/'],
];


// the gallery: public-domain renaissance and gothic works, one per realm. served from Wikimedia Commons
// every filename checked on Commons (26 nov 2026); Codex self-hosts them later. a missing file degrades to its caption.
const ART = [
  { file: '"The_School_of_Athens"_by_Raffaello_Sanzio_da_Urbino.jpg', work: 'The School of Athens', by: 'Raphael', year: '1509–1511', p: 0 },
  { file: 'Pallasetlecentaure.jpg', work: 'Pallas and the Centaur', by: 'Sandro Botticelli', year: 'c. 1482', p: 1 },
  { file: 'Albrecht_Dürer,_Nemesis_(The_Great_Fortune),_c._1501-1502,_NGA_6603.jpg', work: 'Nemesis (The Great Fortune)', by: 'Albrecht Dürer', year: 'c. 1502', p: 2 },
  { file: 'Titian_Bacchus_and_Ariadne.jpg', work: 'Bacchus and Ariadne', by: 'Titian', year: '1520–1523', p: 3 },
  { file: 'Sandro_Botticelli_La_calumnia_de_Apeles.jpg', work: 'The Calumny of Apelles', by: 'Sandro Botticelli', year: 'c. 1494–1495', p: 4 },
  { file: 'Botticelli-primavera.jpg', work: 'Primavera', by: 'Sandro Botticelli', year: 'c. 1480', p: 5 },
  { file: 'Massysm_Quentin_—_The_Moneylender_and_his_Wife_—_1514.jpg', work: 'The Moneylender and His Wife', by: 'Quentin Matsys', year: '1514', p: 6 },
  { file: 'Dürer_Melancholia_I.jpg', work: 'Melencolia I', by: 'Albrecht Dürer', year: '1514', p: 16, note: { en: 'Its magic square sums to 34 in every row, column and diagonal.', nl: 'Het magische vierkant telt in elke rij, kolom en diagonaal op tot 34.', es: 'Su cuadrado mágico suma 34 en cada fila, columna y diagonal.', fr: 'Son carré magique fait 34 sur chaque ligne, colonne et diagonale.', pt: 'O seu quadrado mágico soma 34 em cada linha, coluna e diagonal.', de: 'Sein magisches Quadrat ergibt in jeder Zeile, Spalte und Diagonale 34.', zh: '画中的幻方，每行、每列、每条对角线之和都是 34。' } },
  { file: 'Peter_Paul_Rubens_-_The_Fall_of_Phaeton_(National_Gallery_of_Art).jpg', work: 'The Fall of Phaeton', by: 'Peter Paul Rubens', year: 'c. 1604–1605', p: 18 },
  { file: 'Wukong_and_Princess_Iron_Fan(Rasetsunyo).jpg', work: 'Sun Wukong and Princess Iron Fan', by: 'Japanese woodblock print', year: '19th c.', p: 19 },
  { file: 'Anatomical_Man.jpg', work: 'Très Riches Heures · the Zodiac Man', by: 'Limbourg brothers', year: 'c. 1411–1416', p: 17, gothic: true },
];
const img = f => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(f)}?width=640`;

let lang = document.documentElement.lang || 'en';
const t = k => (T[lang] && T[lang][k]) ?? T.en[k];
const href = d => ROUTES[d] || d;

function render() {
  document.querySelectorAll('[data-r]').forEach(e => e.textContent = t(e.dataset.r));
  document.querySelectorAll('[data-r-html]').forEach(e => e.innerHTML = t(e.dataset.rHtml));
  document.querySelectorAll('.realm[data-door]').forEach(a => a.href = href(a.dataset.door));
  document.querySelectorAll('[data-r$="_b"]').forEach(e => e.textContent = e.textContent.replace(/^[\p{Extended_Pictographic}️‍]+\s*/u, ''));
  if (typeof renderCards === 'function' && document.querySelector('.card')) renderCards();
}
addEventListener('cube-lang', e => { lang = e.detail; render(); });
document.querySelector('main').id = 'top';

// fade the oracle as you scroll away from it
const fade = [document.getElementById('cv'), document.getElementById('dio'), document.getElementById('lantern'), document.querySelector('.delphi'), document.getElementById('whisper'), document.querySelector('header')].filter(Boolean);
addEventListener('scroll', () => { const k = Math.max(0, 1 - scrollY / (innerHeight * .8)); fade.forEach(el => { el.style.opacity = k; el.style.visibility = k < .02 ? 'hidden' : ''; }); }, { passive: true });

// tiny previews: each draws only while visible
const GOLD = '#ffd76a', VIO = '#7a5cb0', CREAM = 'rgba(239,231,210,', COLORS = ['#e8e8e8', '#ffd23f', '#d9433f', '#ff8c3a', '#3b6fd8', '#3fa55b'];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const draw = {
  lab(c, w, h, s) {                       // two roads, one destination
    const A = [[.1, .75], [.35, .3], [.6, .7], [.85, .45]], B = [[.1, .75], [.47, .9], [.85, .45]];
    [[A, VIO], [B, GOLD]].forEach(([pts, col], k) => {
      c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x * w, y * h) : c.moveTo(x * w, y * h)); c.stroke();
      const seg = pts.length - 1, u = (s * .25 + k * .1) % 1 * seg, i = Math.min(seg - 1, Math.floor(u)), f = u - i, [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      c.fillStyle = col; c.beginPath(); c.arc((x0 + (x1 - x0) * f) * w, (y0 + (y1 - y0) * f) * h, 4, 0, 7); c.fill();
    });
    c.fillStyle = CREAM + '.8)'; c.font = '13px ui-monospace,monospace'; c.fillText("R L R′", .3 * w, .22 * h); c.fillText('L', .47 * w, .98 * h - 4);
    c.strokeStyle = GOLD; c.beginPath(); c.arc(.85 * w, .45 * h, 9, 0, 7); c.stroke();
  },
  casino(c, w, h, s) {                    // 54 slots, one ball
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * .4;
    for (let i = 0; i < 54; i++) { const a = i / 54 * 7 * .8976 + s * .3; c.fillStyle = COLORS[i % 6]; c.globalAlpha = .75; c.beginPath(); c.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 3.2, 0, 7); c.fill(); }
    c.globalAlpha = 1; const b = -s * 1.1; c.fillStyle = GOLD; c.beginPath(); c.arc(cx + Math.cos(b) * R * .8, cy + Math.sin(b) * R * .8, 4.5, 0, 7); c.fill();
    c.fillStyle = CREAM + '.85)'; c.font = '600 18px "Bodoni Moda",serif'; c.textAlign = 'center'; c.fillText('1/18', cx, cy + 6); c.textAlign = 'left';
  },
  show(c, w, h, s) {                      // six spotlights sweep the ring
    c.strokeStyle = 'rgba(122,92,176,.5)'; c.beginPath(); c.ellipse(w / 2, h * .8, w * .38, h * .1, 0, 0, 7); c.stroke();
    for (let i = 0; i < 6; i++) { const a = Math.sin(s * .8 + i) * .5, x = w * (.1 + i * .16); const g = c.createLinearGradient(x, 0, x, h * .8); g.addColorStop(0, COLORS[i]); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.globalAlpha = .35; c.beginPath(); c.moveTo(x, 0); c.lineTo(w / 2 + Math.sin(a + i) * w * .3 - 14, h * .8); c.lineTo(w / 2 + Math.sin(a + i) * w * .3 + 14, h * .8); c.fill(); }
    c.globalAlpha = 1;
  },
  note(c, w, h) {                         // the BFS layers, on a log scale
    const L = [1, 18, 243, 3240, 43239], max = Math.log10(43239);
    L.forEach((n, i) => { const bh = (Math.log10(n) / max) * h * .62 + 3, x = w * (.14 + i * .16); c.fillStyle = i === 4 ? GOLD : VIO; c.fillRect(x, h * .8 - bh, w * .1, bh); c.fillStyle = CREAM + '.7)'; c.font = '10px ui-monospace,monospace'; c.fillText(n.toLocaleString('en'), x, h * .8 - bh - 6); });
    c.fillStyle = CREAM + '.5)'; c.fillText('depth 0 → 4', w * .14, h * .93);
  },
  brain(c, w, h, s) {                     // a small constellation, pulses inward
    const n = 12, cx = w / 2, cy = h / 2, R = Math.min(w, h) * .4;
    const P = [...Array(n)].map((_, i) => [cx + Math.cos(i / n * 6.283) * R, cy + Math.sin(i / n * 6.283) * R * .8]);
    c.strokeStyle = 'rgba(122,92,176,.35)'; P.forEach(([x, y], i) => { const [a, b] = P[(i + 3) % n]; c.beginPath(); c.moveTo(x, y); c.lineTo(a, b); c.stroke(); });
    P.forEach(([x, y], i) => { const u = (s * .4 + i / n) % 1; c.fillStyle = GOLD; c.beginPath(); c.arc(x + (cx - x) * u, y + (cy - y) * u, 2, 0, 7); c.fill(); c.fillStyle = CREAM + '.8)'; c.beginPath(); c.arc(x, y, 2.6, 0, 7); c.fill(); });
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, 26); g.addColorStop(0, 'rgba(255,215,106,.9)'); g.addColorStop(1, 'rgba(255,215,106,0)'); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, 26, 0, 7); c.fill();
  },
  kas(c, w, h, s) {                       // a ring of lights around one coin
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * .38;
    for (let i = 0; i < 54; i++) { const a = i / 54 * 6.283; c.fillStyle = (i + Math.floor(s * 6)) % 9 === 0 ? GOLD : 'rgba(122,92,176,.45)'; c.beginPath(); c.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 2.4, 0, 7); c.fill(); }
    c.fillStyle = GOLD; c.font = '700 30px "Bodoni Moda",serif'; c.textAlign = 'center'; c.fillText('☕', cx, cy + 10); c.textAlign = 'left';
  },
};
function sunflower(c, w, h) {             // phyllotaxis: seed k at angle k·137.507…°, radius ∝ √k
  const cx = w / 2, cy = h / 2, N = 520, R = Math.min(w, h) * .47;
  for (let k = 1; k <= N; k++) { const r = R * Math.sqrt(k / N), a = k * GOLDEN_ANGLE; c.fillStyle = k % 21 === 0 ? GOLD : k % 34 === 0 ? '#b4a0d6' : CREAM + (.35 + .5 * k / N) + ')'; c.beginPath(); c.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.2 + 2.6 * Math.sqrt(k / N), 0, 7); c.fill(); }
}

const live = new Set();
function setup(cv, fn, still) {
  const dpr = Math.min(devicePixelRatio || 1, 2), b = cv.getBoundingClientRect();
  cv.width = b.width * dpr; cv.height = b.height * dpr; const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  cv._paint = s => { c.clearRect(0, 0, b.width, b.height); fn(c, b.width, b.height, s); };
  cv._paint(0); cv._still = still;
}
const previews = new Map();
for (const canvas of document.querySelectorAll('canvas[data-prev]')) {
  previews.set(canvas, {draw: draw[canvas.dataset.prev], still: canvas.dataset.prev === 'note'});
}
const sun = document.getElementById('sun');
if (sun) previews.set(sun, {draw: sunflower, still: true});

const observer = new IntersectionObserver(entries => {
  for (const {target, isIntersecting} of entries) {
    if (isIntersecting) {
      const {draw, still} = previews.get(target);
      if (!target._paint) setup(target, draw, still);
      live.add(target);
    } else {
      live.delete(target);
    }
  }
});
for (const canvas of previews.keys()) observer.observe(canvas);

function loop(ts) {
  live.forEach(canvas => { if (!canvas._still) canvas._paint(ts / 1000); });
  if (!reduce) requestAnimationFrame(loop);
}

addEventListener('resize', () => {
  for (const [canvas, {draw, still}] of previews) {
    if (canvas._paint) setup(canvas, draw, still);
  }
});
render();
if (!reduce) requestAnimationFrame(loop);

// ---- new lines in all seven languages ----
const MORE = {
  en: { pi_p: 'Throw random points into a square. The share that lands inside the quarter circle tends to π/4. That is a Monte Carlo method, the same idea as the casino: chance, counted, becomes a constant.', pi_est: '{n} points · π ≈ {v} · off by {e}', credit: 'Paintings and engravings: public domain, via Wikimedia Commons.', g_top: 'Ask the cube. Or scroll, and I will show you around.', g_realms: 'Six doors. Hover one: each preview is the real thing, running.', g_phi: 'The sunflower obeys one angle: 137.5°. Nothing else.', g_pi: 'Every gold dot is a guess. Watch the guesses become π.', g_tiles: 'One of these is a myth. It says so itself.', g_pan: 'Every realm has a keeper, painted 500 years ago.', g_end: 'Back to the top: the oracle is waiting.' },
  nl: { pi_p: 'Gooi willekeurige punten in een vierkant. Het deel dat in de kwartcirkel valt, gaat naar π/4. Dat is een Monte-Carlomethode, hetzelfde idee als het casino: toeval, geteld, wordt een constante.', pi_est: '{n} punten · π ≈ {v} · fout {e}', credit: 'Schilderijen en gravures: publiek domein, via Wikimedia Commons.', g_top: 'Vraag het de kubus. Of scroll, dan leid ik je rond.', g_realms: 'Zes deuren. Elke preview is het echte werk, live.', g_phi: 'De zonnebloem gehoorzaamt één hoek: 137,5°. Meer niet.', g_pi: 'Elk gouden punt is een gok. Kijk hoe de gokken π worden.', g_tiles: 'Eén hiervan is een mythe. Hij zegt het zelf.', g_pan: 'Elk rijk heeft een hoeder, 500 jaar geleden geschilderd.', g_end: 'Terug naar boven: het orakel wacht.' },
  es: { pi_p: 'Lanza puntos al azar en un cuadrado. La parte que cae dentro del cuarto de círculo tiende a π/4. Es un método de Monte Carlo, la misma idea que el casino: el azar, contado, se vuelve una constante.', pi_est: '{n} puntos · π ≈ {v} · error {e}', credit: 'Pinturas y grabados: dominio público, vía Wikimedia Commons.', g_top: 'Pregunta al cubo. O desliza, y te enseño el camino.', g_realms: 'Seis puertas. Cada vista previa es lo real, funcionando.', g_phi: 'El girasol obedece a un solo ángulo: 137,5°. Nada más.', g_pi: 'Cada punto dorado es una apuesta. Mira cómo se vuelven π.', g_tiles: 'Uno de estos es un mito. Lo dice él mismo.', g_pan: 'Cada reino tiene un guardián, pintado hace 500 años.', g_end: 'Arriba: el oráculo espera.' },
  fr: { pi_p: 'Lance des points au hasard dans un carré. La part qui tombe dans le quart de cercle tend vers π/4. C’est une méthode de Monte-Carlo, la même idée que le casino : le hasard, compté, devient une constante.', pi_est: '{n} points · π ≈ {v} · écart {e}', credit: 'Peintures et gravures : domaine public, via Wikimedia Commons.', g_top: 'Interroge le cube. Ou fais défiler, je te guide.', g_realms: 'Six portes. Chaque aperçu est la vraie chose, en marche.', g_phi: 'Le tournesol obéit à un seul angle : 137,5°. Rien d’autre.', g_pi: 'Chaque point doré est un pari. Regarde-les devenir π.', g_tiles: 'L’un d’eux est un mythe. Il le dit lui-même.', g_pan: 'Chaque royaume a un gardien, peint il y a 500 ans.', g_end: 'Remonte : l’oracle t’attend.' },
  pt: { pi_p: 'Atira pontos ao acaso para um quadrado. A parte que cai dentro do quarto de círculo tende para π/4. É um método de Monte Carlo, a mesma ideia do casino: o acaso, contado, torna-se uma constante.', pi_est: '{n} pontos · π ≈ {v} · erro {e}', credit: 'Pinturas e gravuras: domínio público, via Wikimedia Commons.', g_top: 'Pergunta ao cubo. Ou desliza, e eu mostro-te o caminho.', g_realms: 'Seis portas. Cada pré-visualização é a coisa real, a funcionar.', g_phi: 'O girassol obedece a um só ângulo: 137,5°. Mais nada.', g_pi: 'Cada ponto dourado é uma aposta. Vê-as tornarem-se π.', g_tiles: 'Um destes é um mito. Ele próprio o diz.', g_pan: 'Cada reino tem um guardião, pintado há 500 anos.', g_end: 'Volta ao topo: o oráculo espera.' },
  de: { pi_p: 'Wirf zufällige Punkte in ein Quadrat. Der Anteil im Viertelkreis strebt gegen π/4. Das ist eine Monte-Carlo-Methode, dieselbe Idee wie das Casino: Zufall, gezählt, wird zur Konstante.', pi_est: '{n} Punkte · π ≈ {v} · Abweichung {e}', credit: 'Gemälde und Stiche: gemeinfrei, über Wikimedia Commons.', g_top: 'Frag den Würfel. Oder scroll, und ich führe dich herum.', g_realms: 'Sechs Türen. Jede Vorschau ist das Echte, live.', g_phi: 'Die Sonnenblume gehorcht einem Winkel: 137,5°. Sonst nichts.', g_pi: 'Jeder goldene Punkt ist ein Versuch. Sieh zu, wie sie π werden.', g_tiles: 'Eine davon ist ein Mythos. Sie sagt es selbst.', g_pan: 'Jedes Reich hat einen Hüter, vor 500 Jahren gemalt.', g_end: 'Nach oben: das Orakel wartet.' },
  zh: { pi_p: '往正方形里随机撒点。落在四分之一圆里的比例趋向 π/4。这就是蒙特卡洛方法，和赌场是同一个想法：偶然，被数清楚，就成了常数。', pi_est: '{n} 个点 · π ≈ {v} · 误差 {e}', credit: '油画与版画：公有领域，来自 Wikimedia Commons。', g_top: '去问魔方。或者往下滚，我带你看看。', g_realms: '六扇门。每个预览都是真东西，正在运行。', g_phi: '向日葵只服从一个角度：137.5°。仅此而已。', g_pi: '每个金点都是一次猜测。看它们变成 π。', g_tiles: '其中一个是神话。它自己说了。', g_pan: '每个国度都有守护者，画于 500 年前。', g_end: '回到顶部：神谕在等你。' },
};
for (const [k, v] of Object.entries(MORE)) T[k] = { ...(T[k] || {}), ...v };

// π by Monte Carlo: seeded (1729), so every visitor sees the same walk to π
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const piCv = document.getElementById('pi'), piOut = document.getElementById('piest');
let piRnd = mulberry32(1729), piN = 0, piIn = 0, piLive = false;
const PI_MAX = 20000;
function piSetup() {
  const dpr = Math.min(devicePixelRatio || 1, 2), b = piCv.getBoundingClientRect();
  piCv.width = b.width * dpr; piCv.height = b.height * dpr; const c = piCv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, b.width, b.height); c.strokeStyle = 'rgba(122,92,176,.6)'; c.strokeRect(.5, .5, b.width - 1, b.height - 1);
  c.beginPath(); c.arc(0, b.height, b.width, -Math.PI / 2, 0); c.stroke();
  piRnd = mulberry32(1729); piN = 0; piIn = 0; piCv._c = c; piCv._w = b.width; piCv._h = b.height; piText();
}
function piText() { const v = piN ? 4 * piIn / piN : 0; piOut.textContent = t('pi_est').replace('{n}', piN.toLocaleString(lang)).replace('{v}', piN ? v.toFixed(5) : '…').replace('{e}', piN ? Math.abs(v - Math.PI).toFixed(5) : '…'); }
function piStep() {
  if (!piLive || piN >= PI_MAX) return;
  const c = piCv._c, w = piCv._w, h = piCv._h;
  for (let i = 0; i < 60 && piN < PI_MAX; i++) { const x = piRnd(), y = piRnd(), inside = x * x + y * y <= 1; piN++; if (inside) piIn++; c.fillStyle = inside ? 'rgba(255,215,106,.75)' : 'rgba(180,160,214,.35)'; c.fillRect(x * w, (1 - y) * h, 1.6, 1.6); }
  piText();
}
if (piCv) { piSetup(); new IntersectionObserver(([e]) => piLive = e.isIntersecting).observe(piCv); addEventListener('resize', piSetup); (function piLoop() { piStep(); requestAnimationFrame(piLoop); })(); if (reduce) { piLive = true; while (piN < PI_MAX) piStep(); } }

// the guide: one quiet sentence for whatever is on screen; tap the cube to fly back up
const guide = document.getElementById('guide'), say = document.getElementById('say');
const SPOTS = [['top', 'g_top'], ['realms', 'g_realms'], ['sun', 'g_phi'], ['pi', 'g_pi'], ['tiles', 'g_tiles'], ['pantheon', 'g_pan'], ['closing', 'g_end']];
let spot = 'g_top';
function speakGuide(k) { if (k === spot && say.textContent) return; spot = k; say.classList.add('hide'); setTimeout(() => { say.textContent = t(k); say.classList.remove('hide'); clearTimeout(say._h); if (innerWidth < 700) say._h = setTimeout(() => say.classList.add('hide'), 3800); }, 300); }
const gio = new IntersectionObserver(es => { const v = es.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]; if (v) speakGuide(v.target.dataset.guide); }, { threshold: [.35, .6] });
for (const [sel, k] of SPOTS) { const el = sel === 'top' ? document.querySelector('main') : sel === 'tiles' ? document.querySelector('.tiles') : sel === 'closing' ? document.querySelector('.closing') : document.getElementById(sel); if (el) { el.dataset.guide = k; gio.observe(el); } }
setTimeout(() => { guide.classList.add('on'); speakGuide(spot); }, 4200);
document.getElementById('fly').addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
addEventListener('cube-lang', () => { say.textContent = t(spot); piText(); });

// ---- the god cards: a collectible-card treatment (tilt, foil, flip), a hand-drawn sigil per keeper ----
const SIG = {
  0(c, w, h) { const cx = w / 2, cy = h / 2; c.beginPath(); c.arc(cx, cy, w * .14, 0, 7); c.stroke(); for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; c.beginPath(); c.moveTo(cx + Math.cos(a) * w * .19, cy + Math.sin(a) * w * .19); c.lineTo(cx + Math.cos(a) * w * .3, cy + Math.sin(a) * w * .3); c.stroke(); } for (let i = 0; i < 7; i++) { const x = cx - w * .06 + i * w * .02; c.beginPath(); c.moveTo(x, cy - w * .07); c.lineTo(x, cy + w * .07); c.stroke(); } },   // sun + seven-string lyre
  1(c, w, h) { const cx = w / 2, cy = h / 2; for (const s of [-1, 1]) { c.beginPath(); c.arc(cx + s * w * .12, cy, w * .1, 0, 7); c.stroke(); c.beginPath(); c.arc(cx + s * w * .12, cy, w * .035, 0, 7); c.fill(); } c.beginPath(); c.moveTo(cx - w * .03, cy + w * .08); c.lineTo(cx, cy + w * .14); c.lineTo(cx + w * .03, cy + w * .08); c.stroke(); c.beginPath(); c.moveTo(cx - w * .3, cy - w * .16); c.quadraticCurveTo(cx, cy - w * .02, cx + w * .3, cy - w * .16); c.stroke(); },   // owl
  2(c, w, h) { const cx = w / 2, cy = h / 2, R = w * .27; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke(); c.beginPath(); c.arc(cx, cy, R * .2, 0, 7); c.stroke(); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; c.beginPath(); c.moveTo(cx + Math.cos(a) * R * .2, cy + Math.sin(a) * R * .2); c.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); c.stroke(); } },   // the wheel
  3(c, w, h) { const cx = w / 2, cy = h / 2; c.beginPath(); for (let t = 0; t < 22; t += .05) { const r = w * .012 * t; c.lineTo(cx + Math.cos(t) * r, cy + Math.sin(t) * r); } c.stroke(); for (let i = 0; i < 9; i++) { const a = i * 2.4; c.beginPath(); c.arc(cx + Math.cos(a) * w * .3, cy + Math.sin(a) * w * .3, w * .022, 0, 7); c.fill(); } },   // vine spiral, grapes
  4(c, w, h) { const cx = w / 2, cy = h * .45; c.beginPath(); c.ellipse(cx, cy, w * .16, w * .2, 0, 0, 7); c.stroke(); c.beginPath(); c.moveTo(cx, cy + w * .2); c.lineTo(cx, cy + w * .36); c.stroke(); c.beginPath(); c.moveTo(cx - w * .08, cy + w * .36); c.lineTo(cx + w * .08, cy + w * .36); c.stroke(); for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(cx - w * .06 + i * w * .03, cy - w * .1); c.lineTo(cx - w * .1 + i * w * .03, cy + w * .08); c.stroke(); } },   // mirror of truth
  5(c, w, h) { const cx = w / 2; c.beginPath(); c.moveTo(cx, h * .18); c.lineTo(cx, h * .84); c.stroke(); for (const s of [1, -1]) { c.beginPath(); for (let y = h * .3; y < h * .8; y += 2) c.lineTo(cx + s * Math.sin((y - h * .3) / (h * .5) * Math.PI * 3) * w * .1, y); c.stroke(); c.beginPath(); c.moveTo(cx, h * .22); c.quadraticCurveTo(cx + s * w * .2, h * .1, cx + s * w * .32, h * .2); c.quadraticCurveTo(cx + s * w * .18, h * .22, cx, h * .26); c.stroke(); } },   // caduceus
  6(c, w, h) { const cx = w / 2, cy = h * .58; c.beginPath(); c.moveTo(cx - w * .22, cy); c.quadraticCurveTo(cx - w * .3, cy - w * .3, cx - w * .32, cy - w * .26); c.moveTo(cx, cy); c.quadraticCurveTo(cx, cy - w * .4, cx + w * .02, cy - w * .38); c.moveTo(cx + w * .22, cy); c.quadraticCurveTo(cx + w * .3, cy - w * .3, cx + w * .32, cy - w * .26); c.stroke(); c.beginPath(); c.moveTo(cx - w * .24, cy); c.lineTo(cx + w * .24, cy); c.stroke(); for (const [x, y] of [[-.32, -.26], [.02, -.38], [.32, -.26]]) { c.beginPath(); c.arc(cx + x * w, cy + y * w, w * .03, 0, 7); c.fill(); } },   // jester's cap, three bells
  16(c, w, h) { const cx = w / 2, cy = h / 2; c.beginPath(); c.arc(cx, cy, w * .13, 0, 7); c.stroke(); c.beginPath(); c.ellipse(cx, cy, w * .3, w * .07, -.35, 0, 7); c.stroke(); for (let i = 0; i < 16; i++) { c.fillRect(w * .2 + (i % 4) * w * .03, h * .74 + Math.floor(i / 4) * w * .03, w * .018, w * .018); } },   // ringed planet + a 4×4 square
  17(c, w, h) { const P = [[.2, .3], [.35, .22], [.5, .35], [.62, .28], [.78, .4], [.55, .6], [.35, .7], [.7, .74]]; c.beginPath(); P.forEach(([x, y], i) => i ? c.lineTo(x * w, y * h) : c.moveTo(x * w, y * h)); c.stroke(); P.forEach(([x, y]) => { c.beginPath(); c.arc(x * w, y * h, w * .018, 0, 7); c.fill(); }); },   // a constellation
  18(c, w, h) { const x0 = w * .25, y0 = h * .22; c.beginPath(); c.arc(x0, y0, w * .09, 0, 7); c.stroke(); for (let i = 0; i < 18; i++) { const t = i / 18; c.globalAlpha = 1 - t; c.beginPath(); c.arc(x0 + t * w * .5, y0 + t * t * h * .62, w * .05 * (1 - t * .7), 0, 7); c.fill(); } c.globalAlpha = 1; },   // the sun, falling
  19(c, w, h) { const cx = w / 2, cy = h / 2; c.lineWidth *= 2; c.beginPath(); c.moveTo(cx - w * .3, cy + w * .3); c.lineTo(cx + w * .3, cy - w * .3); c.stroke(); c.lineWidth /= 2; for (const [x, y] of [[-.3, .3], [.3, -.3]]) { c.beginPath(); c.arc(cx + x * w, cy + y * w, w * .03, 0, 7); c.fill(); } c.beginPath(); for (let t = 0; t < 12; t += .1) c.lineTo(cx + w * .05 + Math.cos(t) * w * .012 * t, cy + w * .2 + Math.sin(t) * w * .006 * t); c.stroke(); },   // the staff over a cloud
};
function drawSigils() {
  document.querySelectorAll('canvas.sigil').forEach(cv => {
    const dpr = Math.min(devicePixelRatio || 1, 2), b = cv.getBoundingClientRect(); if (!b.width) return;
    cv.width = b.width * dpr; cv.height = b.height * dpr; const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let y = 6; y < b.height; y += 9) for (let x = 6; x < b.width; x += 9) { c.fillStyle = `rgba(122,92,176,${.05 + .07 * Math.random()})`; c.fillRect(x, y, 1.4, 1.4); }
    c.strokeStyle = '#ffd76a'; c.fillStyle = '#ffd76a'; c.lineWidth = 1.4; c.shadowColor = 'rgba(255,215,106,.6)'; c.shadowBlur = 8;
    (SIG[cv.dataset.p] || SIG[17])(c, b.width, b.height);
  });
}
function cardify() {
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('pointermove', e => { const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; card.style.setProperty('--rx', `${(.5 - y) * 14}deg`); card.style.setProperty('--ry', `${(x - .5) * 16}deg`); card.style.setProperty('--mx', `${x * 100}%`); card.style.setProperty('--my', `${y * 100}%`); });
    card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
    card.addEventListener('click', e => { if (e.target.closest('a')) return; card.classList.toggle('flip'); });
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.classList.toggle('flip'); } });
  });
  drawSigils();
}
const ELEM = { 0: '☉', 1: '🜃', 2: '🜄', 3: '🜂', 4: '🜁', 5: '✦', 6: '☉', 16: '♄', 17: '✶', 18: '🜂', 19: '✦' };
function renderCards() {
  document.getElementById('pantheon').innerHTML = ART.map((a, n) => {
    const [g, r, , what0, to] = PANTHEON[a.p]; const what = (KEEPS[lang] || [])[a.p] || what0;
    const stars = '★'.repeat(3 + (n % 3));
    return `<div class="card${a.gothic ? ' gothic' : ''}" tabindex="0"><div class="inner">
      <div class="face front"><img loading="lazy" decoding="async" alt="" src="${img(a.file)}" onload="this.classList.add('ok')" onerror="this.remove()"><canvas class="sigil" data-p="${a.p}"></canvas>
        <div class="top"><span class="el">${ELEM[a.p] || '✦'}</span><span class="st">${stars}</span></div>
        <div class="nm"><b>${g}</b><i>${r}</i></div><div class="foil"></div></div>
      <div class="face back"><b>${g} <i>· ${r}</i></b><span>${what}</span><small>${a.work}<br>${a.by} · ${a.year}</small>${a.note ? `<em>${a.note[lang] || a.note.en}</em>` : ''}${to ? `<a href="${href(to)}">→</a>` : ''}</div>
    </div></div>`; }).join('');
  cardify();
}
addEventListener('resize', drawSigils);
addEventListener('cube-lang', renderCards);
renderCards();

// ---- the triumvirate: three original emblems (a baton, an anvil, a whale's spout) — no company logos ----
const EMB = {
  conductor: `<svg class="em" viewBox="0 0 30 30" aria-hidden="true"><line x1="6" y1="24" x2="22" y2="8" stroke="#efe7d2" stroke-width="1.6" stroke-linecap="round"/><circle cx="23" cy="7" r="2.6" fill="#ff9a5c"><animate attributeName="r" values="2.2;3.4;2.2" dur="1.8s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;.55;1" dur="1.8s" repeatCount="indefinite"/></circle><path d="M23 2v2M28 7h-2M26.5 3.5l-1.4 1.4" stroke="#ff9a5c" stroke-width="1.2" stroke-linecap="round"><animate attributeName="opacity" values="0;1;0" dur="1.8s" repeatCount="indefinite"/></path></svg>`,
  forge: `<svg class="em" viewBox="0 0 30 30" aria-hidden="true"><path d="M5 17h18l-3 4H10l2 4H8l2-4" fill="none" stroke="#efe7d2" stroke-width="1.4" stroke-linejoin="round"/><g fill="#ffd76a">${[0, 1, 2, 3].map(i => `<circle cx="${12 + i * 3}" cy="15" r="1"><animate attributeName="cy" values="15;${5 + i};15" dur="${.9 + i * .2}s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0;1" dur="${.9 + i * .2}s" repeatCount="indefinite"/></circle>`).join('')}</g></svg>`,
  east: `<svg class="em" viewBox="0 0 30 30" aria-hidden="true"><path d="M4 21c4 4 14 4 19-1 2-2 3-1 4-3-2 0-3 1-4 0 0-4-4-7-9-7-5 0-9 4-10 11z" fill="none" stroke="#b4a0d6" stroke-width="1.4" stroke-linejoin="round"/><circle cx="19" cy="15" r=".9" fill="#efe7d2"/><g stroke="#ffd76a" stroke-width="1.2" stroke-linecap="round" fill="none"><path d="M13 9c0-3-2-5-4-5"><animate attributeName="opacity" values="0;1;0" dur="2.2s" repeatCount="indefinite"/></path><path d="M13 9c0-3 2-5 4-5"><animate attributeName="opacity" values="0;1;0" dur="2.2s" begin=".3s" repeatCount="indefinite"/></path><path d="M13 10V3"><animate attributeName="opacity" values="0;1;0" dur="2.2s" begin=".15s" repeatCount="indefinite"/></path></g></svg>`,
};
function triEmblems() { const el = document.getElementById('tri'); if (!el) return; const bs = el.querySelectorAll('b'); [EMB.conductor, EMB.forge, EMB.east].forEach((svg, i) => bs[i] && bs[i].insertAdjacentHTML('beforebegin', svg)); }
triEmblems(); addEventListener('cube-lang', () => setTimeout(triEmblems, 0));

// ---- the cave: Delphi's oracle spoke from a chamber below the temple, over vapour from the rock ----
const caveCv = document.getElementById('cave');
if (caveCv) {
  const cc = caveCv.getContext('2d'); let CW, CH, rocks = [], wisps = [], caveLive = false;
  const caveSize = () => { const dpr = Math.min(devicePixelRatio || 1, 2), b = caveCv.getBoundingClientRect(); CW = b.width; CH = b.height; caveCv.width = CW * dpr; caveCv.height = CH * dpr; cc.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = mulberry32(54); rocks = []; for (let y = 3; y < CH; y += 7) for (let x = 3; x < CW; x += 7) { const nx = (x - CW / 2) / (CW * .26), ny = (y - CH * .98) / (CH * .78); const inside = nx * nx + ny * ny < 1 && y < CH * .98; if (!inside) rocks.push([x, y, 1 + 2.2 * r() * (1 - Math.min(1, Math.hypot(nx, ny) - .8))]); } };
  const caveFrame = ts => { if (caveLive) {
    cc.clearRect(0, 0, CW, CH);
    rocks.forEach(([x, y, s]) => { const d = Math.hypot(x - CW / 2, y - CH * .9) / CW; cc.fillStyle = `rgba(122,92,176,${Math.max(.08, .7 - d * .8)})`; cc.fillRect(x, y, s, s); });
    const g = cc.createRadialGradient(CW / 2, CH * .92, 4, CW / 2, CH * .8, CW * .28); g.addColorStop(0, 'rgba(255,215,106,.55)'); g.addColorStop(.35, 'rgba(255,215,106,.12)'); g.addColorStop(1, 'rgba(255,215,106,0)'); cc.fillStyle = g; cc.fillRect(0, 0, CW, CH);
    if (Math.random() < .25) wisps.push({ x: CW / 2 + (Math.random() - .5) * CW * .12, y: CH * .96, a: 1, s: .3 + Math.random() * .4, ph: Math.random() * 6 });
    wisps = wisps.filter(w => (w.a -= .006) > 0); wisps.forEach(w => { w.y -= w.s; const x = w.x + Math.sin(ts / 700 + w.ph) * 8 * (1 - w.a); cc.fillStyle = `rgba(239,231,210,${w.a * .16})`; cc.beginPath(); cc.arc(x, w.y, 3 + (1 - w.a) * 9, 0, 7); cc.fill(); });
  } if (!reduce) requestAnimationFrame(caveFrame); };
  caveSize(); addEventListener('resize', caveSize); new IntersectionObserver(([e]) => caveLive = e.isIntersecting).observe(caveCv);
  if (reduce) { caveLive = true; caveFrame(0); } else requestAnimationFrame(caveFrame);
}


// ---- share the realm: one tap, native share sheet on phones, copy on desktop. the invite opens the gate. ----
const INVITE = window.CUBE_INVITE || `${location.origin}/thecube/`;
const shareBtn = document.getElementById('share');
if (shareBtn) shareBtn.addEventListener('click', async () => {
  const text = 'join the new realm 🏛️ corvus × the cube';
  try { if (navigator.share) { await navigator.share({ title: 'The Cube · Corvus', text, url: INVITE }); return; } } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(`${text}\n${INVITE}`); shareBtn.textContent = 'copied ✓'; setTimeout(() => shareBtn.textContent = 'share ↗', 1800); }
  catch { prompt('copy:', INVITE); }
});

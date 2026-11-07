export default {
  "title": "datenschutz, ohne nebel.",
  "intro": [
    "wir wollen deine daten nicht.",
    "besuche werden zu anonymen summen, ohne tracking-cookies.",
    "die wenigen gespeicherten dinge (etwa eine stimme oder ein login-code) stehen hier und laufen ab."
  ],
  "updated": "2026-11-06",
  "sections": [
    [
      "who",
      "wer trägt die laterne?",
      "Francisco Gabriel Van Langenhove ist für corvus.gent und stats.corvus.gent verantwortlich, einschließlich musik und spielen. fragen und datenwünsche: <a href=\"mailto:gabriel@corvus.gent\">gabriel@corvus.gent</a>."
    ],
    [
      "counts",
      "was gezählt wird",
      "PostHog EU zählt besuche und erlaubte aktionen standardmäßig, ohne cookies, browserspeicher, profile oder aufnahmen. aus netzwerk-/browserdaten entsteht vorübergehend ein tagespseudonym; nur die summen sind anonym. keine namen, emails oder formularinhalte. GPC, DNT oder ‘zähl mich nicht’ verhindern das laden von PostHog: nur ein seiten-/tageszähler steigt, ohne ID, hash oder gespeicherte header. diese aufrufe sind keine eindeutigen personen."
    ],
    [
      "why",
      "warum und auf welcher grundlage",
      "berechtigtes interesse ist die erklärte grundlage für einfache cookielose besuchsstatistik und missbrauchsschutz. Spotify braucht deinen klick. loginmails, stimmen und buchungen erfüllen deine anfrage. du kannst PostHog hier widersprechen; nur ein anonymer aufruf bleibt. wir verkaufen keine daten."
    ],
    [
      "storage",
      "was bleibt und wie lange",
      "login-code: 3 minuten. sitzung: 7 tage oder bis zum abmelden. login-protokolle, zugangsanfragen und besucherprognosen mit email: höchstens 90 tage. missbrauchsgrenzen: höchstens 24 stunden, mit täglich wechselndem gesalzenem IP-hash; unsere app speichert keine rohen IP-adressen. bot-prüfungen: 5 minuten. spielverlauf auf dem server: 48 stunden nach nutzung; serien und schutz gegen doppelte stimmen: bis zu einem jahr. anonyme summen und öffentliche songvorschläge bleiben eventuell bis zur löschung.",
      "die speicherdauer für analytics-ereignisse hängt von der PostHog-einstellung ab; unser ziel sind 90 tage, die kontoeinstellung ist noch zu bestätigen. hosting- und emailanbieter haben eigene fristen für protokolle und backups. frag mich nach den aktuellen details.",
      "Resend: US-speicherung; emails/protokolle 30 tage bei Free/Pro/Scale, backups 7 tage; Enterprise kann abweichen. <a href=\"https://resend.com/security/gdpr/\" rel=\"noreferrer\">Resend GDPR</a>."
    ],
    [
      "sf",
      "nachrichten zur sf-reise",
      "wenn du das sf-formular abschickst, sieht nur gabe name, kontakt, tätigkeit, treffvorschläge, daten, ort und nachricht im privaten dashboard. wir nutzen sie für das gewünschte treffen (erfüllung deiner anfrage), nicht für marketing. jeder eintrag wird 60 tage nach dem absenden automatisch aus Redis gelöscht; als erledigt markieren verlängert das nicht.",
      "eine kopie geht über Resend an gabriel@corvus.gent, die hier beschriebene ausnahme mit us-speicherung. Resend hat eigene fristen für versandprotokolle; gabe muss die benachrichtigung innerhalb derselben 60 tage aus seinem postfach löschen. bitte ihn um frühere löschung, auch bei angabe eines x-namens oder linkedin-profils.",
      "das signierte vid-cookie dient auch dem formularschutz; prüfungen verfallen nach 5 minuten, ip-hashes wechseln täglich und verfallen innerhalb eines tages, wiederholungsbelege nach 24 stunden. der zettel nutzt sessionStorage (sf-note:2026-11) für einmaliges erscheinen je tab-sitzung. optionale statistik zählt aktionen, niemals deine eingaben."
    ],
    [
      "browser",
      "in deinem browser",
      "notwendige cookies: sess hält dich angemeldet; vid verhindert doppelte sprachstimmen; mvid merkt sich musikstimmen und täglichen spielfortschritt. sie sind signiert, gesichert und für seitenskripte unzugänglich. sess läuft nach 7 tagen ab, vid und mvid nach einem jahr. sie sind niemals analytics-kennungen.",
      "ein lokaler privacy-choice-eintrag merkt sich ‘ok’ oder ‘zähl mich nicht’. ‘ok’ zählt einen soldier pro browser/website-origin; nach dem löschen der sitedaten erneut möglich. der eintrag geht nicht an PostHog. analytics und kampagnen bleiben im arbeitsspeicher, ohne browserspeicher."
    ],
    [
      "outside",
      "andere dienste",
      "Spotify erhält erst nach play eine wiedergabeanfrage und kann dann eigene cookies setzen. unser server fragt bei Spotify oder Apple nach, wenn du einen songlink einreichst. CARTO-kartenkacheln kommen über unseren server, ohne deine IP weiterzugeben. Leaflet, Sortable und die PostHog-bibliothek liegen hier.",
      "Buy Me a Coffee und Pidgy sind links, keine eingebetteten formulare. nach dem anklicken gelten deren regeln. /links, /go und kampagnen-kurzlinks ergänzen nur UTM-kategorien und zählen besuche/klicks; sie erfassen weder formulare noch besucheridentitäten.",
      "Notion enthält mein manuell gepflegtes X-protokoll. öffentliche statistiken zeigen summen, öffentliche kampagnen- und stilnamen und meine eigenen posts; antworttexte und ziel-URLs bleiben hinter dem login. freigegebene kampagnen und regions-stunden begleiten die freiwillige analyse. Corvus-kopien verfallen binnen 24 stunden; quelldaten folgen meiner Notion-aufbewahrung. die region muss noch bestätigt werden; reine EU-speicherung wird nicht versprochen.",
      "zum zählen der kaffees liest unser server kurz die daten von Buy Me a Coffee. wiederkehrende unterstützer erkennt er, wenn möglich, am konto oder an der e-mail-adresse. nur summen und das datum des letzten kaffees werden 30 minuten gespeichert.",
      "PostHog EU zählt besuche und erlaubte aktionen standardmäßig, ohne cookies, browserspeicher, profile oder aufnahmen. aus netzwerk-/browserdaten entsteht vorübergehend ein tagespseudonym; nur die summen sind anonym. keine namen, emails oder formularinhalte. GPC, DNT oder ‘zähl mich nicht’ verhindern das laden von PostHog: nur ein seiten-/tageszähler steigt, ohne ID, hash oder gespeicherte header. diese aufrufe sind keine eindeutigen personen."
    ],
    [
      "where",
      "wohin die daten gehen",
      "unsere Vercel-funktionen sind für Frankfurt (fra1) konfiguriert. statische dateien und die weiterleitung von anfragen nutzen ein weltweites netz. PostHog EU liegt in Frankfurt. auch Redis soll nach Frankfurt; die aktuelle datenbankregion und der erfolgte umzug müssen noch geprüft werden.",
      "Resend bleibt vorläufig eine ausnahme: Irland ist die geplante versandregion, noch im konto zu prüfen. mailinhalte und protokolle werden jedoch in den USA gespeichert. ein versand aus Irland ändert daran nichts. <a href=\"https://resend.com/docs/dashboard/domains/regions\" rel=\"noreferrer\">Resend</a>.",
      "Vercel ist ein US-unternehmen. das <a href=\"https://vercel.com/legal/dpa\" rel=\"noreferrer\">Vercel DPA</a> und das <a href=\"https://vercel.com/security\" rel=\"noreferrer\">EU–US Data Privacy Framework</a> bieten garantien für übermittlungen; sie bedeuten nicht, dass sämtliche anbieterprotokolle, supportzugriffe oder sicherungskopien in der EU bleiben. kontoeinstellungen und geltende vereinbarungen sind noch zu bestätigen."
    ],
    [
      "rights",
      "deine rechte",
      "schreib mir für auskunft, berichtigung, löschung, einschränkung oder übertragbarkeit deiner daten oder einen widerspruch gegen verarbeitung auf grundlage berechtigten interesses. schließen von player oder seite widerruft die wiedergabeeinwilligung; bereits gesetzte cookies verwaltet Spotify. normalerweise antworten wir innerhalb eines monats. ein angemessener identitätsnachweis kann nötig sein; anonyme summen lassen sich dir nicht zuordnen.",
      "beschwerden sind bei der belgischen Datenschutzbehörde möglich: <a href=\"https://www.gegevensbeschermingsautoriteit.be/\" rel=\"noreferrer\">gegevensbeschermingsautoriteit.be</a>."
    ]
  ],
  "providersTitle": "wer diese seite betreibt",
  "providersNote": "Vercel hostet, PostHog EU zählt, Resend verschickt login-emails und ein verwalteter Redis-dienst speichert vorübergehende daten. der eingesetzte Redis-anbieter und die region sind noch zu bestätigen; frag mich nach den details. externe dienste können daten außerhalb des EWR unter ihren verträgen und übermittlungsgarantien verarbeiten. ihre richtlinien erklären auch protokolle und backups.",
  "roles": [
    "hosting",
    "analytics",
    "login-emails",
    "Redis, falls Upstash",
    "Redis, falls Redis Cloud",
    "kartenkacheln",
    "wiedergabe",
    "songabfrage",
    "unterstützung",
    "buchungen",
    "manuelles x-protokoll"
  ],
  "consentInfo": "gezählt wird standardmäßig. ‘ok’ schließt den hinweis und zählt einen soldier; es ist keine analytics-einwilligung. ‘zähl mich nicht’, GPC und DNT wechseln zu anonymen seitenaufrufen. die wahl bleibt bis zur änderung oder zum löschen der daten. ein widerspruch bleibt bei neuen hinweisen gültig."
};

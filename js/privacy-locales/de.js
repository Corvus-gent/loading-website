export default {
  "title": "datenschutz, ohne nebel.",
  "intro": [
    "wir wollen deine daten nicht.",
    "mit deiner erlaubnis werden besuche zu anonymen summen, ohne tracking-cookies.",
    "die wenigen gespeicherten dinge (etwa eine stimme oder ein login-code) stehen hier und laufen ab."
  ],
  "updated": "aktualisiert am 4. november 2026",
  "sections": [
    [
      "who",
      "wer trägt die laterne?",
      "Francisco Gabriel Van Langenhove ist für corvus.gent und stats.corvus.gent verantwortlich, einschließlich musik und spielen. fragen und datenwünsche: <a href=\"mailto:gabriel@corvus.gent\">gabriel@corvus.gent</a>."
    ],
    [
      "counts",
      "was gezählt wird",
      "erst nach deiner erlaubnis für optionale analytics: seitenbesuche, grobe land- und browserkategorien, bekannte linkziele und einfache musik-/spielaktionen. PostHog EU zählt ohne tracking-cookies oder persönliche profile. netzwerk- und browserinformationen werden kurz zu einem täglichen pseudonym verarbeitet; erst die summen sind anonym. keine namen, emails, formularinhalte, suchtexte oder aufnahmen in unseren analytics. öffentliche karte und pingle nutzen nur gerundete stadtdaten mit mindestens zwei gezählten besuchern."
    ],
    [
      "why",
      "warum und auf welcher grundlage",
      "einwilligung: optionale PostHog-analytics und, getrennt davon, ein klick auf play für Spotify. berechtigtes interesse: missbrauch verhindern und anonyme summen nutzen. erfüllung deiner anfrage: login, stimmen, spiele, zugangsanfragen und buchungen. schließe Spotify oder die seite zum stoppen. wir verkaufen keine daten. do-not-track und global privacy control werden berücksichtigt."
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
      "deine analytics-wahl und die datenschutzversion bleiben 180 tage in diesem browser, oder bis sich die richtlinie ändert. localStorage merkt sich deine sprachstimme, sprache, eingangspräferenz, federn, ergebnisse und gelesene spielanleitungen bis zu einem jahr nach dem speichern. löschen der websitedaten entfernt einstellungen, keine bereits abgegebenen stimmen."
    ],
    [
      "outside",
      "andere dienste",
      "Spotify erhält erst nach play eine wiedergabeanfrage und kann dann eigene cookies setzen. unser server fragt bei Spotify oder Apple nach, wenn du einen songlink einreichst. CARTO-kartenkacheln kommen über unseren server, ohne deine IP weiterzugeben. Leaflet, Sortable und die PostHog-bibliothek liegen hier.",
      "Buy Me a Coffee und Pidgy sind links, keine eingebetteten formulare. nach dem anklicken gelten deren regeln. /links, /go und kampagnen-kurzlinks ergänzen nur UTM-kategorien und zählen besuche/klicks; sie erfassen weder formulare noch besucheridentitäten. (analytics nur mit einwilligung).",
      "Notion enthält mein manuell gepflegtes X-protokoll. öffentliche statistiken zeigen summen, öffentliche kampagnen- und stilnamen und meine eigenen posts; antworttexte und ziel-URLs bleiben hinter dem login. freigegebene kampagnen und regions-stunden begleiten die freiwillige analyse. Corvus-kopien verfallen binnen 24 stunden; quelldaten folgen meiner Notion-aufbewahrung. die region muss noch bestätigt werden; reine EU-speicherung wird nicht versprochen."
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
  "consentInfo": "optionale analytics bleibt bis zu deiner erlaubnis aus. ändere deine wahl hier jederzeit. jede website-origin merkt sich die eigene wahl 180 tage. ablehnen schränkt die seite nicht ein; besuchsstatistiken zählen nur zustimmende besucher. ein widerruf stoppt künftige verarbeitung, ohne frühere verarbeitung rückgängig zu machen."
};

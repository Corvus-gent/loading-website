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
      "browser",
      "in deinem browser",
      "notwendige cookies: sess hält dich angemeldet; vid verhindert doppelte sprachstimmen; mvid merkt sich musikstimmen und täglichen spielfortschritt. sie sind signiert, gesichert und für seitenskripte unzugänglich. sess läuft nach 7 tagen ab, vid und mvid nach einem jahr. sie sind niemals analytics-kennungen.",
      "deine analytics-wahl und die datenschutzversion bleiben 180 tage in diesem browser, oder bis sich die richtlinie ändert. localStorage merkt sich deine sprachstimme, sprache, eingangspräferenz, federn, ergebnisse und gelesene spielanleitungen bis zu einem jahr nach dem speichern. löschen der websitedaten entfernt einstellungen, keine bereits abgegebenen stimmen."
    ],
    [
      "outside",
      "andere dienste",
      "Spotify erhält erst nach play eine wiedergabeanfrage und kann dann eigene cookies setzen. unser server fragt bei Spotify oder Apple nach, wenn du einen songlink einreichst. CARTO-kartenkacheln kommen über unseren server, ohne deine IP weiterzugeben. Leaflet, Sortable und die PostHog-bibliothek liegen hier.",
      "Buy Me a Coffee und Pidgy sind links, keine eingebetteten formulare. nach dem anklicken gelten deren regeln. /links, /go und kampagnen-kurzlinks ergänzen nur UTM-kategorien und zählen besuche/klicks; sie erfassen weder formulare noch besucheridentitäten. (analytics nur mit einwilligung)."
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
    "buchungen"
  ],
  "consentInfo": "optionale analytics bleibt bis zu deiner erlaubnis aus. ändere deine wahl hier jederzeit. jede website-origin merkt sich die eigene wahl 180 tage. ablehnen schränkt die seite nicht ein; besuchsstatistiken zählen nur zustimmende besucher. ein widerruf stoppt künftige verarbeitung, ohne frühere verarbeitung rückgängig zu machen."
};

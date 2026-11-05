export default {
  "title": "privacy, zonder mist.",
  "intro": [
    "we willen je data niet.",
    "met je toestemming worden bezoeken anonieme totalen, zonder trackingcookies.",
    "het beetje dat we bewaren (zoals een stem of inlogcode) staat hieronder en vervalt."
  ],
  "updated": "bijgewerkt op 4 november 2026",
  "sections": [
    [
      "who",
      "wie draagt de lantaarn?",
      "Francisco Gabriel Van Langenhove is verantwoordelijk voor corvus.gent en stats.corvus.gent, inclusief muziek en games. vragen of dataverzoeken: <a href=\"mailto:gabriel@corvus.gent\">gabriel@corvus.gent</a>."
    ],
    [
      "counts",
      "wat we tellen",
      "alleen nadat je optionele analytics toestaat: paginaweergaven, algemene land- en browsercategorieën, bekende linkbestemmingen en eenvoudige acties bij muziek en games. PostHog EU telt zonder trackingcookies of persoonlijke profielen. netwerk- en browserinformatie wordt kort verwerkt tot een dagelijks pseudoniem; alleen de uiteindelijke totalen zijn anoniem. namen, e-mails, formulierinhoud, zoektekst en opnames horen niet in onze analytics. de openbare kaart en pingle gebruiken alleen afgeronde stadsgegevens met minstens twee getelde bezoekers."
    ],
    [
      "why",
      "waarom, en op welke grond",
      "toestemming: optionele PostHog-analytics en, apart daarvan, op play klikken voor Spotify. gerechtvaardigd belang: misbruik voorkomen en anonieme totalen gebruiken. uitvoering van je verzoek: inlogmails, stemmen, games, toegangsaanvragen en boekingen. sluit de Spotify-speler of pagina om afspelen te stoppen. we verkopen geen bezoekersdata. voor analytics respecteren we do-not-track en global privacy control."
    ],
    [
      "storage",
      "wat blijft, en hoelang",
      "inlogcode: 3 minuten. sessie: 7 dagen of tot je uitlogt. login- en toegangsaanvragen en voorspellingen gekoppeld aan je e-mail: maximaal 90 dagen. misbruiklimieten: maximaal 24 uur, met elke dag een andere gezouten IP-hash; onze app bewaart geen ruwe IP-adressen. controles tegen bots: 5 minuten. spelgeschiedenis op de server: 48 uur na gebruik; streaks en controle op dubbele stemmen: maximaal een jaar. anonieme totalen en openbare songsuggesties kunnen blijven tot ze worden verwijderd.",
      "de bewaartermijn van analytics wordt in PostHog ingesteld; ons doel is 90 dagen, maar die accountinstelling moet nog bevestigd worden. hosting- en mailproviders hebben eigen termijnen voor logs en back-ups. vraag me gerust naar de actuele details.",
      "Resend: opslag in de VS; mails/logs 30 dagen op Free/Pro/Scale, back-ups 7 dagen; Enterprise kan afwijken. <a href=\"https://resend.com/security/gdpr/\" rel=\"noreferrer\">Resend GDPR</a>."
    ],
    [
      "sf",
      "berichten voor de sf-trip",
      "als je het sf-formulier verstuurt, kan alleen gabe je naam, contact, werk, plannen, datums, plaats en bericht zien in het privédashboard. we gebruiken dit om je gevraagde afspraak te regelen (uitvoering van je verzoek), niet voor marketing. elk formulierrecord verdwijnt automatisch uit Redis 60 dagen na inzending; afvinken verlengt dit niet.",
      "een kopie gaat via Resend naar gabriel@corvus.gent, de beschreven uitzondering met opslag in de vs. Resend heeft een eigen bewaartermijn voor verzendlogs; gabe moet de melding binnen dezelfde 60 dagen uit zijn mailbox verwijderen. vraag gabe om eerdere verwijdering, ook als je een x-naam of linkedin-profiel gebruikte.",
      "de ondertekende vid-cookie dient ook voor formulierbeveiliging; controles verlopen na 5 minuten, ip-hashes wisselen dagelijks en verlopen binnen een dag, ontvangstbewijzen voor nieuwe pogingen na 24 uur. het briefje gebruikt sessionStorage (sf-note:2026-11) om eenmaal per tabsessie te verschijnen. optionele analytics telt alleen briefje- en formulieracties, nooit je invoer."
    ],
    [
      "browser",
      "het kleine beetje in je browser",
      "noodzakelijke cookies: sess houdt je ingelogd; vid voorkomt dubbele taalstemmen; mvid onthoudt muziekstemmen en dagelijkse spelvoortgang. ze zijn ondertekend, beveiligd en niet leesbaar door paginascripts. sess vervalt na 7 dagen, vid en mvid na een jaar. we gebruiken ze nooit om je in analytics te herkennen.",
      "je analyticskeuze en privacyversie blijven in deze browser 180 dagen bewaard, of tot het beleid wijzigt. localStorage bewaart je taalstemkeuze, je taal, realm-voorkeur, veren, spelresultaten en gelezen speluitleg tot een jaar na het opslaan. sitegegevens wissen verwijdert voorkeuren, niet de stemmen die al zijn uitgebracht."
    ],
    [
      "outside",
      "wanneer een andere dienst meedoet",
      "Spotify krijgt pas na play een afspeelverzoek en kan dan eigen cookies plaatsen. onze server zoekt een song op bij Spotify of Apple wanneer je een link indient. kaarttegels komen via onze server van CARTO, zonder je IP door te sturen. Leaflet, Sortable en de PostHog-bibliotheek staan hier lokaal.",
      "Buy Me a Coffee en Pidgy-booking zijn links, geen ingebouwde formulieren. na doorklikken gelden hun privacyregels. /links, /go en onze campagnesnelkoppelingen voegen alleen campagnelabels (UTMs) toe en tellen bezoeken/klikken; ze verzamelen geen formulierinhoud of bezoekersidentiteiten. (analytics alleen met toestemming).",
      "Notion bevat mijn handmatig ingevulde X-log. openbare stats tonen totalen, publieke campagne- en stemlabels en mijn eigen posts; replyteksten en doel-URL’s blijven achter de login. goedgekeurde campagnes en regio-uurvakken horen bij optionele analytics. kopieën op Corvus vervallen binnen 24 uur; bronregels volgen mijn Notion-bewaarbeleid. de werkruimteregio moet nog worden bevestigd, dus uitsluitend EU-opslag wordt niet beloofd."
    ],
    [
      "where",
      "waar de gegevens naartoe gaan",
      "onze Vercel-functies zijn ingesteld op Frankfurt (fra1). statische bestanden en de routering van verzoeken gebruiken een wereldwijd netwerk. PostHog EU staat in Frankfurt. ook Redis moet naar Frankfurt; de huidige databaseregio en de uitgevoerde verhuis moeten nog worden gecontroleerd.",
      "Resend blijft tijdelijk een uitzondering: Ierland is de beoogde verzendregio, nog te controleren in het account, maar mailinhoud en logs worden in de VS opgeslagen. een Ierse verzendregio verandert dat niet. <a href=\"https://resend.com/docs/dashboard/domains/regions\" rel=\"noreferrer\">Resend</a>.",
      "Vercel is een Amerikaans bedrijf. de <a href=\"https://vercel.com/legal/dpa\" rel=\"noreferrer\">Vercel DPA</a> en het <a href=\"https://vercel.com/security\" rel=\"noreferrer\">EU–US Data Privacy Framework</a> bieden waarborgen voor doorgifte; dat betekent niet dat alle providerlogs, ondersteuning of back-ups in de EU blijven. onze accountinstellingen en toepasselijke overeenkomsten moeten nog worden bevestigd."
    ],
    [
      "rights",
      "jouw gegevens, jouw stem",
      "mail me voor inzage, correctie, verwijdering, beperking of overdraagbaarheid, of om bezwaar te maken tegen verwerking op basis van gerechtvaardigd belang. toestemming voor afspelen intrekken kan door de speler of pagina te sluiten; Spotify beheert cookies die het al plaatste. normaal antwoorden we binnen een maand. we kunnen beperkt bewijs vragen dat het om jouw gegevens gaat; anonieme totalen kunnen we niet naar jou herleiden.",
      "een klacht kan bij de Belgische Gegevensbeschermingsautoriteit: <a href=\"https://www.gegevensbeschermingsautoriteit.be/\" rel=\"noreferrer\">gegevensbeschermingsautoriteit.be</a>."
    ]
  ],
  "providersTitle": "wie helpt deze plek draaien",
  "providersNote": "Vercel host de site, PostHog EU verzorgt tellingen, Resend verstuurt inlogmails en een beheerde Redis-dienst bewaart de tijdelijke gegevens. de gebruikte Redis-provider en regio moeten nog bevestigd worden; vraag me naar de actuele details. externe diensten kunnen onder hun overeenkomsten en doorgiftewaarborgen gegevens buiten de EER verwerken. hun beleid beschrijft ook logs en back-ups.",
  "roles": [
    "hosting",
    "analytics",
    "inlogmails",
    "Redis-provider, indien Upstash",
    "Redis-provider, indien Redis Cloud",
    "kaarttegels",
    "afspelen",
    "songs opzoeken",
    "steunbetalingen",
    "boekingen",
    "handmatig x-log"
  ],
  "consentInfo": "optionele analytics staat uit tot je toestemming geeft. je kunt je keuze hier altijd wijzigen. elk siteadres onthoudt zijn eigen keuze 180 dagen. weigeren beperkt de site niet; bezoekstatistieken tellen alleen mensen die toestemming geven. intrekken stopt toekomstige analytics, zonder eerdere verwerking ongedaan te maken."
};

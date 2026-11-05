export default {
  "title": "la vie privée, sans brouillard.",
  "intro": [
    "nous ne voulons pas de vos données.",
    "avec votre accord, les visites deviennent des totaux anonymes, sans cookies de suivi.",
    "le peu que nous gardons (un vote, un code de connexion) est décrit ici et expire."
  ],
  "updated": "mise à jour le 4 novembre 2026",
  "sections": [
    [
      "who",
      "qui tient la lanterne ?",
      "Francisco Gabriel Van Langenhove est responsable de corvus.gent et stats.corvus.gent, musique et jeux compris. questions et demandes : <a href=\"mailto:gabriel@corvus.gent\">gabriel@corvus.gent</a>."
    ],
    [
      "counts",
      "ce qui est compté",
      "uniquement après votre accord pour les analytics facultatives : visites, catégories générales de pays et de navigateurs, destinations connues et actions simples dans les jeux et la musique. PostHog EU compte sans cookies de suivi ni profils personnels. les informations réseau et navigateur deviennent brièvement un pseudonyme quotidien ; seuls les totaux obtenus sont anonymes. aucun nom, email, formulaire, recherche ou enregistrement dans nos statistiques. la carte publique et pingle utilisent des villes aux coordonnées arrondies avec au moins deux visiteurs comptés."
    ],
    [
      "why",
      "pourquoi, et sur quelle base",
      "consentement : analytics PostHog facultatives et, séparément, clic sur lecture pour Spotify. intérêt légitime : prévenir les abus et utiliser les totaux anonymes. exécution de votre demande : connexion, votes, jeux, demandes d’accès et réservations. fermez le lecteur Spotify ou la page pour arrêter la lecture. nous ne vendons pas vos données. nous respectons do-not-track et global privacy control."
    ],
    [
      "storage",
      "ce qui reste, et combien de temps",
      "code : 3 minutes. session : 7 jours ou jusqu’à la déconnexion. journaux de connexion, demandes d’accès et prédictions liées à un email : 90 jours maximum. limites anti-abus : 24 heures maximum, avec un hachage IP salé différent chaque jour ; notre application ne conserve pas les IP brutes. défis anti-bots : 5 minutes. historique de jeu sur le serveur : 48 heures après utilisation ; séries et protection contre les votes doubles : un an maximum. totaux anonymes et suggestions musicales publiques : jusqu’à suppression.",
      "la durée des événements analytics dépend du réglage PostHog ; notre objectif est 90 jours, mais ce réglage reste à confirmer. les hébergeurs et services email ont leurs propres durées pour journaux et sauvegardes. contactez-moi pour les détails actuels.",
      "Resend : stockage aux États-Unis ; emails/journaux 30 jours sur Free/Pro/Scale, sauvegardes 7 jours ; Enterprise peut différer. <a href=\"https://resend.com/security/gdpr/\" rel=\"noreferrer\">Resend GDPR</a>."
    ],
    [
      "sf",
      "messages pour le voyage à sf",
      "si tu envoies le formulaire sf, seul gabe peut voir ton nom, contact, activité, choix de rencontre, dates, lieu et message dans le tableau privé. ces données servent à organiser la rencontre demandée (exécution de ta demande), pas au marketing. chaque fiche est supprimée automatiquement de Redis 60 jours après l’envoi ; la marquer comme traitée ne prolonge pas ce délai.",
      "une copie est envoyée à gabriel@corvus.gent via Resend, l’exception de stockage aux états-unis documentée ici. Resend applique sa propre conservation des journaux ; gabe doit supprimer la notification de sa boîte sous les mêmes 60 jours. contacte-le pour une suppression anticipée, même avec un pseudo x ou un profil linkedin.",
      "le cookie signé vid sert aussi à éviter les abus du formulaire ; les défis expirent après 5 minutes, les empreintes ip changent chaque jour et expirent sous un jour, les reçus de nouvelle tentative sous 24 heures. le billet utilise sessionStorage (sf-note:2026-11) pour apparaître une fois par session d’onglet. les statistiques facultatives comptent les actions, jamais les champs."
    ],
    [
      "browser",
      "dans votre navigateur",
      "cookies nécessaires : sess maintient la connexion ; vid évite les doubles votes de langue ; mvid conserve votes musicaux et progression quotidienne. signés, sécurisés, inaccessibles aux scripts. sess expire après 7 jours, vid et mvid après un an. jamais utilisés comme identifiants analytics.",
      "votre choix analytics et la version de confidentialité restent dans ce navigateur 180 jours, ou jusqu’au changement de politique. localStorage conserve votre vote de langue, la langue, préférence d’entrée, plumes, résultats et lecture des instructions jusqu’à un an après sauvegarde. effacer les données du site retire les préférences, pas les votes déjà envoyés."
    ],
    [
      "outside",
      "les autres services",
      "Spotify ne reçoit une demande de lecture qu’après votre clic et peut ensuite déposer ses cookies. notre serveur recherche un morceau chez Spotify ou Apple lorsque vous proposez un lien. les tuiles CARTO passent par notre serveur sans transmettre votre IP. Leaflet, Sortable et la bibliothèque PostHog sont hébergés ici.",
      "Buy Me a Coffee et Pidgy sont des liens, pas des formulaires intégrés. leurs règles s’appliquent après le clic. /links, /go et les raccourcis de campagne ajoutent seulement des étiquettes UTM et comptent visites/clics, sans contenu de formulaire ni identité. (analytics uniquement avec consentement).",
      "Notion contient mon journal X saisi à la main. les stats publiques montrent des totaux, des noms publics de campagnes et de styles, et mes propres posts ; les réponses et URL cibles restent derrière la connexion. campagnes approuvées et créneaux région-heure accompagnent les statistiques facultatives. les copies Corvus expirent sous 24 heures ; les sources suivent ma conservation Notion. la région reste à confirmer, sans garantie de stockage exclusivement dans l’UE."
    ],
    [
      "where",
      "où vont les données",
      "nos fonctions Vercel sont configurées à Francfort (fra1). les fichiers statiques et le routage utilisent un réseau mondial. PostHog EU est à Francfort. Francfort est aussi la destination prévue pour Redis ; la région actuelle et la migration restent à vérifier.",
      "Resend reste une exception temporaire : l’Irlande est la région d’envoi prévue, à vérifier dans le compte, mais le contenu des emails et les journaux sont stockés aux États-Unis. envoyer depuis l’Irlande ne change pas ce stockage. <a href=\"https://resend.com/docs/dashboard/domains/regions\" rel=\"noreferrer\">Resend</a>.",
      "Vercel est une entreprise américaine. son <a href=\"https://vercel.com/legal/dpa\" rel=\"noreferrer\">Vercel DPA</a> et le <a href=\"https://vercel.com/security\" rel=\"noreferrer\">EU–US Data Privacy Framework</a> encadrent les transferts ; ils ne garantissent pas que tous les journaux, accès d’assistance et sauvegardes restent dans l’UE. nos paramètres et accords applicables restent à confirmer."
    ],
    [
      "rights",
      "vos droits",
      "écrivez-moi pour accéder à vos données, les corriger, les supprimer, limiter leur utilisation, demander leur portabilité ou vous opposer au traitement fondé sur l’intérêt légitime. fermer le lecteur ou la page retire le consentement à la lecture ; Spotify gère ses cookies déjà déposés. réponse normalement sous un mois. une preuve proportionnée peut être nécessaire ; les totaux anonymes ne permettent pas de vous retrouver.",
      "vous pouvez porter plainte auprès de l’Autorité belge de protection des données : <a href=\"https://www.gegevensbeschermingsautoriteit.be/\" rel=\"noreferrer\">gegevensbeschermingsautoriteit.be</a>."
    ]
  ],
  "providersTitle": "qui fait fonctionner le site",
  "providersNote": "Vercel héberge, PostHog EU compte, Resend envoie les codes et un service Redis géré garde les données temporaires. le fournisseur Redis déployé et sa région restent à confirmer ; demandez-moi les détails actuels. certains services peuvent traiter des données hors EEE sous leurs accords et garanties de transfert. leurs politiques couvrent aussi journaux et sauvegardes.",
  "roles": [
    "hébergement",
    "analytics",
    "emails de connexion",
    "Redis, si Upstash",
    "Redis, si Redis Cloud",
    "tuiles cartographiques",
    "lecture",
    "recherche musicale",
    "soutien financier",
    "réservations",
    "journal x manuel"
  ],
  "consentInfo": "les analytics facultatives restent désactivées sans votre accord. modifiez votre choix ici à tout moment. chaque origine du site retient son propre choix pendant 180 jours. refuser ne limite pas le site ; seuls les visiteurs ayant accepté sont comptés. le retrait arrête les traitements futurs sans annuler ceux déjà effectués."
};

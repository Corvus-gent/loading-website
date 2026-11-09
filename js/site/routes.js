// Single source for navigation, hubs, the directory and the command palette.
export const SECTIONS = [
  {
    "id": "quests",
    "label": "Quests",
    "path": "/quests/",
    "line": "things built. lessons earned.",
    "next": "/hack/3/",
    "cta": "Meet the robots"
  },
  {
    "id": "daily",
    "label": "Daily",
    "path": "/daily/",
    "line": "a small reason to come back.",
    "next": "/games/",
    "cta": "Play today"
  },
  {
    "id": "legion",
    "label": "Legion",
    "path": "/legion/",
    "line": "different worlds. one shared standard.",
    "next": "/legion/#enlist",
    "cta": "Enlist"
  },
  {
    "id": "live",
    "label": "Live",
    "path": "/live/",
    "line": "one-man army. many editors.",
    "next": "/live/",
    "cta": "Watch live"
  },
  {
    "id": "gabe",
    "label": "Gabe",
    "path": "/gabe/",
    "line": "builder. fighter. sidequest collector.",
    "next": "/call/",
    "cta": "Book a call"
  }
];
export const ROUTES = [
  {
    "path": "/friends/cardneto/",
    "file": "friends/cardneto/index.html",
    "section": "quests",
    "title": "Cardneto",
    "description": "The event app Dorian kept missing.",
    "status": "open"
  },
  {
    "path": "/map/",
    "file": "map/index.html",
    "section": "gabe",
    "title": "the whole map",
    "description": "Every public corner, in one place.",
    "status": "open"
  },
  {
    "path": "/gabe/",
    "file": "gabe/index.html",
    "section": "gabe",
    "title": "gabe",
    "description": "Builder, fighter, occasional sidequest.",
    "status": "open"
  },
  {
    "path": "/live/",
    "file": "live/index.html",
    "section": "live",
    "title": "live",
    "description": "One-man army. Many editors.",
    "status": "open"
  },
  {
    "path": "/legion/",
    "file": "legion/index.html",
    "section": "legion",
    "title": "legion",
    "description": "Driven people. Different worlds. One shared standard.",
    "status": "open"
  },
  {
    "path": "/daily/",
    "file": "daily/index.html",
    "section": "daily",
    "title": "daily",
    "description": "A small reason to come back.",
    "status": "open"
  },
  {
    "path": "/quests/",
    "file": "quests/index.html",
    "section": "quests",
    "title": "quests",
    "description": "Built in public. Some won. Some taught me something.",
    "status": "open"
  },
  {
    "path": "/airbnb-filter",
    "file": "airbnb-filter/index.html",
    "section": "gabe",
    "title": "me vs the Airbnb filter",
    "description": "A tiny experiment in saying what booking sites will not.",
    "status": "experiment"
  },
  {
    "path": "/army",
    "file": "army/index.html",
    "section": "legion",
    "title": "war room",
    "description": "Missions, recruits and the things we ship.",
    "status": "members"
  },
  {
    "path": "/battle",
    "file": "battle/index.html",
    "section": "quests",
    "title": "Codex vs Compound",
    "description": "Same footage. Different briefs. Vote blind.",
    "status": "vote"
  },
  {
    "path": "/build",
    "file": "build/index.html",
    "section": "quests",
    "title": "one man. one army.",
    "description": "Watch the codebase grow, one commit at a time.",
    "status": "live stats"
  },
  {
    "path": "/call",
    "file": "call/index.html",
    "section": "gabe",
    "title": "book a call",
    "description": "Five minutes free. Bring one good question.",
    "status": "open"
  },
  {
    "path": "/compound",
    "file": "compound/index.html",
    "section": "quests",
    "title": "the $1,000 cut",
    "description": "Watch V1. Tell the editor what to change.",
    "status": "open"
  },
  {
    "path": "/compound/rules",
    "file": "compound/rules/index.html",
    "section": "quests",
    "title": "feedback, with ground rules",
    "description": "How the video experiment works, and what your help means.",
    "status": "rules"
  },
  {
    "path": "/compound/v2",
    "file": "compound/v2/index.html",
    "section": "quests",
    "title": "100 videos. one deadline.",
    "description": "Vote the next cut in seven recorded languages.",
    "status": "contest"
  },
  {
    "path": "/dinner",
    "file": "dinner/index.html",
    "section": "gabe",
    "title": "dinner in SF",
    "description": "You pick the place. I bring the stories.",
    "status": "open"
  },
  {
    "path": "/gabinho-rolls",
    "file": "gabinho-rolls/index.html",
    "section": "gabe",
    "title": "roll or surf",
    "description": "Mat time, salt water, new people.",
    "status": "open"
  },
  {
    "path": "/games/hub",
    "file": "games/hub/index.html",
    "section": "daily",
    "title": "the arcade",
    "description": "Eight puzzles and one cage.",
    "status": "playable"
  },
  {
    "path": "/games",
    "file": "games/index.html",
    "section": "daily",
    "title": "play today",
    "description": "A new puzzle. One daily streak.",
    "status": "daily"
  },
  {
    "path": "/hack/1",
    "file": "hack/1/index.html",
    "section": "quests",
    "title": "01 / HackTheFeed",
    "description": "We built it. Pitched anyway.",
    "status": "pitched"
  },
  {
    "path": "/hack/1/the-feed",
    "file": "hack/1/the-feed/index.html",
    "section": "quests",
    "title": "try HackTheFeed",
    "description": "Paste a company site. Find a new angle for your next video.",
    "status": "beta"
  },
  {
    "path": "/hack/3",
    "file": "hack/3/index.html",
    "section": "quests",
    "title": "03 / robotics",
    "description": "Robots, interviews and a 24-hour content streak.",
    "status": "live project"
  },
  {
    "path": "/hack",
    "file": "hack/index.html",
    "section": "quests",
    "title": "hackathons",
    "description": "Three hackathons. One increasingly strange week.",
    "status": "ongoing"
  },
  {
    "path": "/hack/play",
    "file": "hack/play/index.html",
    "section": "daily",
    "title": "OSSMAN",
    "description": "Pac-Man in an octagon. Skill issue?",
    "status": "playable"
  },
  {
    "path": "/hackathons",
    "file": "hackathons/index.html",
    "section": "quests",
    "title": "the squads",
    "description": "The people behind the hackathons.",
    "status": "archive"
  },
  {
    "path": "/hackthefeed",
    "file": "hackthefeed/index.html",
    "section": "quests",
    "title": "the original hackathon log",
    "description": "An archived doorway to the builds that started this week.",
    "status": "archive"
  },
  {
    "path": "/languages",
    "file": "languages/index.html",
    "section": "daily",
    "title": "pick the next language",
    "description": "A small vote in how this corner of the internet speaks.",
    "status": "vote"
  },
  {
    "path": "/links/corvus",
    "file": "links/corvus/index.html",
    "section": "gabe",
    "title": "Corvus links",
    "description": "The community, its channels and its next open door.",
    "status": "connect"
  },
  {
    "path": "/links/pidgy",
    "file": "links/pidgy/index.html",
    "section": "gabe",
    "title": "Pidgy links",
    "description": "The product and the people building it.",
    "status": "connect"
  },
  {
    "path": "/music",
    "file": "music/index.html",
    "section": "daily",
    "title": "music",
    "description": "Vote a track into the room.",
    "status": "community"
  },
  {
    "path": "/now",
    "file": "now/index.html",
    "section": "daily",
    "title": "right now",
    "description": "One line from wherever Gabe is.",
    "status": "journal"
  },
  {
    "path": "/people",
    "file": "people/index.html",
    "section": "gabe",
    "title": "people",
    "description": "The people, projects and personalities around Corvus.",
    "status": "directory"
  },
  {
    "path": "/plethora",
    "file": "plethora/index.html",
    "section": "daily",
    "title": "Plethora",
    "description": "Find games worth keeping.",
    "status": "friend"
  },
  {
    "path": "/plethora/stats",
    "file": "plethora/stats/index.html",
    "section": "daily",
    "title": "Plethora referrals",
    "description": "How many clicks the army sent, and from which doorway.",
    "status": "live stats"
  },
  {
    "path": "/privacy",
    "file": "privacy/index.html",
    "section": "gabe",
    "title": "privacy",
    "description": "What is stored, why, and how to leave.",
    "status": "plain English"
  },
  {
    "path": "/push",
    "file": "push/index.html",
    "section": "quests",
    "title": "one video. one army.",
    "description": "Give the chosen video a minute and an honest comment.",
    "status": "support"
  },
  {
    "path": "/realm",
    "file": "realm/index.html",
    "section": "gabe",
    "title": "the old realm",
    "description": "A little mystery is allowed.",
    "status": "wander"
  },
  {
    "path": "/sf",
    "file": "sf/index.html",
    "section": "gabe",
    "title": "meet in San Francisco",
    "description": "Founders, fighters, artists. Cool people in general.",
    "status": "in SF"
  },
  {
    "path": "/sidequests",
    "file": "sidequests/index.html",
    "section": "quests",
    "title": "the sidequests",
    "description": "Experiments beyond the main mission.",
    "status": "wander"
  },
  {
    "path": "https://stats.corvus.gent/army",
    "file": "stats/army/index.html",
    "section": "live",
    "title": "the army, counted",
    "description": "Visits, enlistments and people who said yes.",
    "status": "live stats"
  },
  {
    "path": "https://stats.corvus.gent/coffee",
    "file": "stats/coffee/index.html",
    "section": "live",
    "title": "coffee for the army",
    "description": "The coffees that keep the builds moving.",
    "status": "live stats"
  },
  {
    "path": "https://stats.corvus.gent/games",
    "file": "stats/games/index.html",
    "section": "live",
    "title": "the daily games, counted",
    "description": "Puzzles played and streaks kept.",
    "status": "live stats"
  },
  {
    "path": "https://stats.corvus.gent/hack",
    "file": "stats/hack/index.html",
    "section": "live",
    "title": "HackTheFeed, counted",
    "description": "Visits, app opens and feedback for the first hack.",
    "status": "live stats"
  },
  {
    "path": "https://stats.corvus.gent/hunt",
    "file": "stats/hunt/index.html",
    "section": "live",
    "title": "curiosity, counted",
    "description": "The secrets people found while wandering.",
    "status": "live stats"
  },
  {
    "path": "https://stats.corvus.gent/",
    "file": "stats/index.html",
    "section": "live",
    "title": "the public numbers",
    "description": "Visits, clicks and the shape of the army.",
    "status": "live stats"
  },
  {
    "path": "https://stats.corvus.gent/map",
    "file": "stats/map/index.html",
    "section": "live",
    "title": "where the army is",
    "description": "A map of the visits we can place.",
    "status": "live stats"
  },
  {
    "path": "https://stats.corvus.gent/music",
    "file": "stats/music/index.html",
    "section": "live",
    "title": "the rotation in numbers",
    "description": "What people listen to and vote for.",
    "status": "live stats"
  },
  {
    "path": "https://stats.corvus.gent/pidgy",
    "file": "stats/pidgy/index.html",
    "section": "live",
    "title": "Corvus → Pidgy",
    "description": "The people sent from here to Pidgy.",
    "status": "live stats"
  },
  {
    "path": "https://stats.corvus.gent/status",
    "file": "stats/status/index.html",
    "section": "live",
    "title": "is everything awake?",
    "description": "Service checks, history and honest failures.",
    "status": "live status"
  },
  {
    "path": "https://stats.corvus.gent/x",
    "file": "stats/x/index.html",
    "section": "live",
    "title": "the X log",
    "description": "Posts, clicks and the record of building out loud.",
    "status": "live stats"
  },
  {
    "path": "/support/books",
    "file": "support/books/index.html",
    "section": "gabe",
    "title": "books worth keeping",
    "description": "The books Gabe comes back to.",
    "status": "shelf"
  },
  {
    "path": "/support/companies",
    "file": "support/companies/index.html",
    "section": "gabe",
    "title": "companies worth watching",
    "description": "Builders and products on Gabe’s radar.",
    "status": "directory"
  },
  {
    "path": "/support/founders",
    "file": "support/founders/index.html",
    "section": "gabe",
    "title": "founders worth following",
    "description": "People making things happen.",
    "status": "directory"
  },
  {
    "path": "/support",
    "file": "support/index.html",
    "section": "gabe",
    "title": "back the people building",
    "description": "A directory of people, projects and ways to help.",
    "status": "directory"
  },
  {
    "path": "/support/people",
    "file": "support/people/index.html",
    "section": "gabe",
    "title": "people worth knowing",
    "description": "Good people from different corners of the world.",
    "status": "directory"
  },
  {
    "path": "/support/philosophists",
    "file": "support/philosophists/index.html",
    "section": "gabe",
    "title": "old ideas. new questions.",
    "description": "Thinkers who still interrupt the conversation.",
    "status": "reading"
  },
  {
    "path": "/support/sport-people",
    "file": "support/sport-people/index.html",
    "section": "gabe",
    "title": "people who put in the rounds",
    "description": "Athletes, fighters and the work behind them.",
    "status": "directory"
  },
  {
    "path": "/wiki/corvus",
    "file": "wiki/corvus/index.html",
    "section": "legion",
    "title": "what is Corvus?",
    "description": "The story, the principles and the people behind the crow.",
    "status": "read"
  },
  {
    "path": "/wiki/corvus/namesakes",
    "file": "wiki/corvus/namesakes/index.html",
    "section": "legion",
    "title": "why the crow?",
    "description": "The many meanings carried by the name Corvus.",
    "status": "read"
  },
  {
    "path": "/wiki",
    "file": "wiki/index.html",
    "section": "legion",
    "title": "the field notes",
    "description": "People, ideas and stories that shaped this place.",
    "status": "read"
  },
  {
    "path": "/wiki/pidgy",
    "file": "wiki/pidgy/index.html",
    "section": "legion",
    "title": "what is Pidgy?",
    "description": "A closer look at the product.",
    "status": "read"
  },
  {
    "path": "/hack/2",
    "file": null,
    "section": "quests",
    "title": "02 / OSSMAN",
    "description": "The internet named it. You can play it.",
    "status": "shipped"
  },
  {
    "path": "/cv",
    "file": null,
    "section": "gabe",
    "title": "the CV",
    "description": "The short version. Work, builds, education.",
    "status": "read",
    "type": "pdf"
  },
  {
    "path": "/links/gabe",
    "file": "links/index.html",
    "section": "gabe",
    "title": "Gabe’s links",
    "description": "Every place to find Gabe.",
    "status": "connect"
  },
  {
    "path": "/402/",
    "file": "402/index.html",
    "section": "gabe",
    "title": "402 · the crow’s other door",
    "description": "An old corner worth finding.",
    "status": "secret"
  },
  {
    "path": "/hack/the-feed/",
    "file": "hack/the-feed/index.html",
    "section": "quests",
    "title": "HackTheFeed · original demo door",
    "description": "The original try-page, kept intact.",
    "status": "archive"
  },
  {
    "path": "/hackthefeed/2/",
    "file": "hackthefeed/2/index.html",
    "section": "quests",
    "title": "Hack #2 · original countdown",
    "description": "The page before the cage opened.",
    "status": "archive"
  }
];

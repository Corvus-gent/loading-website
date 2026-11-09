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
    "title": "Me vs. the Airbnb filter",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
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
    "title": "The useful chaos: rules \u2014 Corvus",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
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
    "title": "Try HackTheFeed \u00b7 early beta",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
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
    "title": "Gabe's hackathon run, SF 2026",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
  },
  {
    "path": "/languages",
    "file": "languages/index.html",
    "section": "daily",
    "title": "Languages",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
  },
  {
    "path": "/links/corvus",
    "file": "links/corvus/index.html",
    "section": "gabe",
    "title": "Corvus",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
  },
  {
    "path": "/links/pidgy",
    "file": "links/pidgy/index.html",
    "section": "gabe",
    "title": "Pidgy",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
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
    "title": "Corvus \u00d7 Plethora \u00b7 live referral stats",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
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
    "title": "One video. One army. \u00b7 Corvus",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
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
    "title": "Sidequests \u2014 Gabriel",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
  },
  {
    "path": "https://stats.corvus.gent/army",
    "file": "stats/army/index.html",
    "section": "live",
    "title": "the army, counted",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
  },
  {
    "path": "https://stats.corvus.gent/coffee",
    "file": "stats/coffee/index.html",
    "section": "live",
    "title": "coffees bought for gabe",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
  },
  {
    "path": "https://stats.corvus.gent/games",
    "file": "stats/games/index.html",
    "section": "live",
    "title": "daily games",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
  },
  {
    "path": "https://stats.corvus.gent/hack",
    "file": "stats/hack/index.html",
    "section": "live",
    "title": "HackTheFeed \u00b7 corvus stats",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
  },
  {
    "path": "https://stats.corvus.gent/hunt",
    "file": "stats/hunt/index.html",
    "section": "live",
    "title": "curiosity, counted",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
  },
  {
    "path": "https://stats.corvus.gent/",
    "file": "stats/index.html",
    "section": "live",
    "title": "Stats",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
  },
  {
    "path": "https://stats.corvus.gent/map",
    "file": "stats/map/index.html",
    "section": "live",
    "title": "every ping, ever",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
  },
  {
    "path": "https://stats.corvus.gent/music",
    "file": "stats/music/index.html",
    "section": "live",
    "title": "the rotation in numbers",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
  },
  {
    "path": "https://stats.corvus.gent/pidgy",
    "file": "stats/pidgy/index.html",
    "section": "live",
    "title": "corvus \u2192 pidgy",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
  },
  {
    "path": "https://stats.corvus.gent/status",
    "file": "stats/status/index.html",
    "section": "live",
    "title": "service status",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
  },
  {
    "path": "https://stats.corvus.gent/x",
    "file": "stats/x/index.html",
    "section": "live",
    "title": "the x log",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
  },
  {
    "path": "/support/books",
    "file": "support/books/index.html",
    "section": "gabe",
    "title": "Books",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
  },
  {
    "path": "/support/companies",
    "file": "support/companies/index.html",
    "section": "gabe",
    "title": "Companies",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
  },
  {
    "path": "/support/founders",
    "file": "support/founders/index.html",
    "section": "gabe",
    "title": "Founders",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
  },
  {
    "path": "/support",
    "file": "support/index.html",
    "section": "gabe",
    "title": "Support",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
  },
  {
    "path": "/support/people",
    "file": "support/people/index.html",
    "section": "gabe",
    "title": "People",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
  },
  {
    "path": "/support/philosophists",
    "file": "support/philosophists/index.html",
    "section": "gabe",
    "title": "Philosophists",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
  },
  {
    "path": "/support/sport-people",
    "file": "support/sport-people/index.html",
    "section": "gabe",
    "title": "Sport people",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
  },
  {
    "path": "/wiki/corvus",
    "file": "wiki/corvus/index.html",
    "section": "legion",
    "title": "Corvus",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
  },
  {
    "path": "/wiki/corvus/namesakes",
    "file": "wiki/corvus/namesakes/index.html",
    "section": "legion",
    "title": "The many meanings of Corvus",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
  },
  {
    "path": "/wiki",
    "file": "wiki/index.html",
    "section": "legion",
    "title": "Main page",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
  },
  {
    "path": "/wiki/pidgy",
    "file": "wiki/pidgy/index.html",
    "section": "legion",
    "title": "Pidgy",
    "description": "A corner of Corvus. Follow your curiosity.",
    "status": "open"
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
    "path": "/cv/",
    "file": null,
    "section": "gabe",
    "title": "the CV",
    "description": "The short version. Work, builds, education.",
    "status": "read"
  }
];

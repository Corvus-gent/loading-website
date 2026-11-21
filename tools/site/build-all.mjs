import {execFileSync} from 'node:child_process';
execFileSync("node", ["tools/migration-report/build.mjs"], {stdio:'inherit'});
execFileSync("node", ["tools/plethora/verify-routes.mjs"], {stdio:'inherit'});
execFileSync("node", ["tools/build-gabinho-rolls.mjs"], {stdio:'inherit'});
execFileSync("node", ["tools/build-battle.mjs"], {stdio:'inherit'});
execFileSync("node", ["tools/build-hackathons.mjs"], {stdio:'inherit'});
execFileSync("node", ["tools/build-plethora.mjs"], {stdio:'inherit'});
// Compile CV profiles before discovery scans the static routes.
execFileSync("node", ["tools/cv/build.mjs"], {stdio:'inherit'});
execFileSync("node", ["tools/site/build.mjs"], {stdio:'inherit'});
execFileSync("python3", ["tools/build-search.py"], {stdio:'inherit'});

// Render feedback forms after site chrome so the Sonar design stays isolated.
execFileSync("node", ["tools/forms/build.mjs"], {stdio:'inherit'});

// Localized CV output is compiled last, outside the general site chrome.
execFileSync("node", ["tools/philosophy/build.mjs"], {stdio:'inherit'});

// Inline Hackers Bay landing styles into its static deployment output.
execFileSync("node", ["lib/hackersbay/build-landing.js"], {stdio:'inherit'});

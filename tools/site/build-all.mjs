import {execFileSync} from 'node:child_process';
execFileSync("node", ["tools/plethora/verify-routes.mjs"], {stdio:'inherit'});
execFileSync("node", ["tools/build-gabinho-rolls.mjs"], {stdio:'inherit'});
execFileSync("node", ["tools/build-battle.mjs"], {stdio:'inherit'});
execFileSync("node", ["tools/build-hackathons.mjs"], {stdio:'inherit'});
execFileSync("node", ["tools/build-plethora.mjs"], {stdio:'inherit'});
execFileSync("node", ["tools/site/build.mjs"], {stdio:'inherit'});
execFileSync("python3", ["tools/build-search.py"], {stdio:'inherit'});
execFileSync("node", ["tools/site/performance.mjs"], {stdio:'inherit'});

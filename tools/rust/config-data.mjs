// Compile existing configuration as data, without changing the authoritative files.
import {readFileSync,writeFileSync} from 'node:fs';
import {LIVE,STREAM_ID} from '../../live.config.js';
import {LIVE_MODE_UNTIL} from '../../hack/live-mode-config.js';
import {PLETHORA_PLACEMENTS,PLETHORA_ALIASES,PLETHORA_CATEGORIES} from '../../js/plethora-config.js';
import {SOCIALS} from '../../live/socials.js';
const output=JSON.stringify({live:LIVE,stream:STREAM_ID,until:LIVE_MODE_UNTIL,socials:SOCIALS},null,2)+'\n';
const file=new URL('../../rust/migration/live-config.json',import.meta.url);
if(process.argv.includes('--check')){if(readFileSync(file,'utf8')!==output)throw Error('Rust live config is stale; run node tools/rust/config-data.mjs.');}else writeFileSync(file,output);

const plethora=JSON.stringify({placements:PLETHORA_PLACEMENTS,aliases:PLETHORA_ALIASES,categories:PLETHORA_CATEGORIES},null,2)+"\n";
const file2=new URL("../../rust/migration/plethora-config.json",import.meta.url);
if(process.argv.includes("--check")){if(readFileSync(file2,"utf8")!==plethora)throw Error("Rust Plethora config is stale");}else writeFileSync(file2,plethora);

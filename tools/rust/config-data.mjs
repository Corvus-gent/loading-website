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

const {CONFIG,CALL_TIERS,BMC_URL,LINKEDIN_PROFILE_URL,SUPPORT_LINKS,SUPPORT_STEPS}=await import('../../js/support-config.js');
const support=JSON.stringify({config:CONFIG,tiers:CALL_TIERS,bmcURL:BMC_URL,linkedinURL:LINKEDIN_PROFILE_URL,links:Object.entries(SUPPORT_LINKS),steps:Object.entries(SUPPORT_STEPS)},null,2)+'\n';
const file3=new URL('../../rust/migration/support-config.json',import.meta.url);
if(process.argv.includes('--check')){if(readFileSync(file3,'utf8')!==support)throw Error('Rust support config is stale');}else writeFileSync(file3,support);

const {PRIVACY_VERSION,strings}=await import('../../js/privacy-strings.js');
const {STREAM_NOTICE,STREAM_PRIVACY}=await import('../../js/privacy-stream.js');
const {ARMY_PRIVACY}=await import('../../js/army/privacy-copy.js');
const privacyPages={};for(const lang of Object.keys(strings))privacyPages[lang]=(await import(`../../js/privacy-locales/${lang}.js`)).default;
const privacy=JSON.stringify({version:PRIVACY_VERSION,strings,streamNotice:STREAM_NOTICE,streamPrivacy:STREAM_PRIVACY,army:ARMY_PRIVACY,pages:privacyPages},null,2)+'\n';
const file4=new URL('../../rust/migration/privacy-config.json',import.meta.url);
if(process.argv.includes('--check')){if(readFileSync(file4,'utf8')!==privacy)throw Error('Rust privacy copy is stale');}else writeFileSync(file4,privacy);

const compoundModule=await import('../../compound/v2/config.js');
const compound=JSON.stringify({deadline:compoundModule.DEADLINE,seeds:compoundModule.SEED_VIDEOS},null,2)+'\n';
const file5=new URL('../../rust/migration/compound-v2-config.json',import.meta.url);
if(process.argv.includes('--check')){if(readFileSync(file5,'utf8')!==compound)throw Error('Rust Compound v2 config is stale');}else writeFileSync(file5,compound);

// Build guard: exercise the actual handler without counting test HEAD requests.
import assert from 'node:assert/strict';
import handler from '../../api/_plethora.js';
import {PLETHORA_PLACEMENTS,PLETHORA_ALIASES} from '../../js/plethora-config.js';
const ossman=new Set(['start','gameover','promo','pause','battle','hack','celtix','compound','game']);
export const agents=['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)','Mozilla/5.0 (Linux; Android 15)','Mozilla/5.0 (Macintosh; Intel Mac OS X)'];
export const expected=id=>`${ossman.has(id)?'https://share.plethora.studio/retro/ossman?code=GABE':'https://plethora.studio/download?utm_source=gabe'}&utm_medium=corvus&utm_content=${id}`;
let checked=0;
for(const id of [...Object.keys(PLETHORA_PLACEMENTS),...Object.keys(PLETHORA_ALIASES)])for(const ua of agents){
 const headers={};let status;const res={setHeader:(k,v)=>headers[k]=v,status:n=>(status=n,res),end:()=>{},json:()=>{}};
 await handler({method:'HEAD',headers:{'user-agent':ua},query:{slug:'plethora-'+id,store:'1',platform:'android',noCount:'1',redirect:'https://example.invalid'}},res);
 assert.equal(status,302,id);assert.equal(headers.Location,expected(PLETHORA_ALIASES[id]||id),id);checked++;
}
console.log(`PASS: ${checked} redirect checks (36 placements/aliases × iPhone, Android, desktop); only the two official URLs; no tracking writes.`);

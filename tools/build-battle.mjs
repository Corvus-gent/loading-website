import fs from 'node:fs';
const has=name=>fs.existsSync('public/battle/'+name+'.mp4');
fs.writeFileSync('battle/media.json',JSON.stringify({codex:has('codex'),compound:has('compound'),bonuses:['compound-bonus-1','compound-bonus-2'].filter(has)},null,2)+'\n');
console.log('Battle media manifest ready.');

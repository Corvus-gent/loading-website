import fs from 'node:fs/promises';
const hub = await fs.readFile('games/hub/index.html','utf8');
const catalog = hub.match(/<section class="plethora-catalog"[\s\S]*?<\/section>/)?.[0];
if (!catalog) throw Error('Missing game catalog');
const page = await fs.readFile('games/index.html','utf8');
await fs.writeFile('games/index.html',page.replace(/(<!-- PLETHORA_CATALOG -->[\s\S]*?)<section class="plethora-catalog"[\s\S]*?<\/section>/,(_,heading)=>heading+catalog));

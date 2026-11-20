import fs from 'node:fs/promises';
import {PHILOSOPHY_ROUTES,renderPhilosophyPage} from '../../lib/philosophy/page.mjs';
const copy=JSON.parse(await fs.readFile('cv/filosofie/content.json','utf8'));
for(const [lang,route]of Object.entries(PHILOSOPHY_ROUTES)){
 const dir=route.slice(1);await fs.mkdir(dir,{recursive:true});await fs.writeFile(dir+'/index.html',renderPhilosophyPage(lang,copy));
}
console.log('Philosophy CV: two language routes, one shared page component.');

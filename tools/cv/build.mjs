import fs from 'node:fs/promises';import path from 'node:path';
import {renderCV} from '../../lib/cv/page.mjs';
import {validatePdfAssets} from '../../lib/cv/pdf-contract.mjs';
const data=JSON.parse(await fs.readFile('cv/profiles.json','utf8')),metrics=JSON.parse(await fs.readFile('stats/linkedin/data.json','utf8'));
const github=JSON.parse(await fs.readFile('cv/github-activity.json','utf8'));
await validatePdfAssets(data,metrics);
for(const profile of data.profiles){const dir=profile.path.replace(/^\//,'').replace(/\/$/,'');await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'index.html'),renderCV(profile,data,metrics,github));}
console.log(`CV portfolio: ${data.profiles.length} shared application profiles.`);

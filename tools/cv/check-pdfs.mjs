import fs from 'node:fs/promises';
import {validatePdfAssets} from '../../lib/cv/pdf-contract.mjs';
const data=JSON.parse(await fs.readFile('cv/profiles.json','utf8'));
const metrics=JSON.parse(await fs.readFile('stats/linkedin/data.json','utf8'));
console.log(`PASS: ${await validatePdfAssets(data,metrics)} current, verified one-page CV downloads.`);

// Serve the technical CV immediately; complete the optional counters in the background.
import fs from 'node:fs';
import path from 'node:path';
import {waitUntil} from '@vercel/functions';
import {pipeline,connected} from './_redis.js';
import {createCvDownloadHandler} from './_cv-download.js';
export default createCvDownloadHandler({
  readPdf:()=>fs.readFileSync(path.join(process.cwd(),'cv','gabe.pdf')),
  count:pipeline,
  ready:connected,
  schedule:waitUntil
});

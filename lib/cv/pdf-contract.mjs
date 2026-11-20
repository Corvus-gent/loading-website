// Keep committed download assets in step with their authored data and generator.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export function canonicalJSON(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJSON).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalJSON(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
export function pdfInput(profile, data, metrics) {
  return {
    version: 1,
    profile: Object.fromEntries(['slug','path','kind','label','summary','pdf'].map(key => [key,profile[key]])),
    name: data.name, email: data.email, location: data.location, updated: data.updated,
    education: data.education, experience: data.experience,
    research: data.research, projects: data.projects,
    summer2027Locations: ['tech','social-media'].includes(profile.slug) ? data.summer2027Locations : null,
    metrics: profile.kind === 'social' ? {totals:metrics.totals,source:metrics.source} : null
  };
}
export async function validatePdfAssets(data, metrics, root = process.cwd()) {
  let manifest;
  try { manifest = JSON.parse(await fs.readFile(path.join(root,'cv/pdf-manifest.json'),'utf8')); }
  catch { throw Error('CV PDF manifest missing or invalid. Run python3 tools/cv/build-pdfs.py, then commit the PDFs and cv/pdf-manifest.json.'); }
  const generatorHash = sha256(await fs.readFile(path.join(root,'tools/cv/build-pdfs.py')));
  for (const profile of data.profiles) {
    const record = manifest.profiles?.[profile.slug];
    const inputHash = sha256(canonicalJSON(pdfInput(profile,data,metrics)));
    if (!record || record.inputHash !== inputHash || record.generatorHash !== generatorHash) {
      throw Error(`Stale CV PDF: ${profile.slug}. Run python3 tools/cv/build-pdfs.py --only ${profile.slug} and commit its PDF and cv/pdf-manifest.json.`);
    }
    const bytes = await fs.readFile(path.join(root,'cv',profile.pdf));
    if (bytes.subarray(0,5).toString() !== '%PDF-' || sha256(bytes) !== record.fileHash || record.pages !== 1) {
      throw Error(`Invalid or changed CV PDF: ${profile.slug}. Regenerate its one-page PDF with tools/cv/build-pdfs.py.`);
    }
  }
  return data.profiles.length;
}

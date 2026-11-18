import { cities, curated } from './catalog.js';
import { score } from './score.js';
import { signal } from './enrich.js';
import snapshot from './snapshot.js';
import priorSnapshot from './prior-snapshot.js';
import { verified } from './verified.js';
import discovered from './discovered.js';
import wikidata from './wikidata-snapshot.js';

export { cities };
const seenIds = new Set(), seenDomains = new Set();
const seeds = [...curated,...discovered,...wikidata].filter(company=>{
  const domain=company.domain.replace(/^www\./i,'').toLowerCase();
  if (seenIds.has(company.id) || (domain && seenDomains.has(domain))) return false;
  seenIds.add(company.id);
  if (domain) seenDomains.add(domain);
  return true;
});
export const catalog = seeds.map(company => {
  const data = snapshot[company.id] || {};
  const signals = {
    ...data,
    ...company.signals,
    ...(company.founded ? { founded: signal(company.founded, company.source, 'scraped', 'medium', company.asOf) } : {}),
    ...verified[company.id],
  };
  const risk = score(signals);
  const previous = priorSnapshot[company.id];
  const priorDate = Object.values(previous || {}).map(item=>item.fetchedAt).sort().at(-1);
  const currentDate = [data.jobs?.fetchedAt,data.github?.fetchedAt].filter(Boolean).sort().at(-1);
  if (priorDate && currentDate && currentDate>priorDate) {
    const priorSignals = { ...signals, jobs:previous.jobs, github:previous.github };
    const old = score(priorSignals,new Date(priorDate));
    const comparable = risk.breakdown.every((rule,i)=>Boolean(rule.signal)===Boolean(old.breakdown[i].signal)
      && (!rule.signal || rule.signal.source===old.breakdown[i].signal.source));
    if (comparable && risk.value!==null && old.value!==null) {
      risk.trend=risk.value-old.value;
      risk.priorAt=priorDate;
    }
    if (signals.jobs && previous.jobs?.source===signals.jobs.source && previous.jobs.fetchedAt<signals.jobs.fetchedAt) {
      signals.jobs={...signals.jobs,value:{...signals.jobs.value,delta:signals.jobs.value.count-previous.jobs.value.count,priorAt:previous.jobs.fetchedAt}};
    }
  }
  return { ...company, signals, risk };
});

export function summary(dossier) {
  const { signals, risk } = dossier;
  const change = signals.github ? { text: 'Most recent observed public push was ' + signals.github.value.pushedAt.slice(0, 10) + '.', source: signals.github.source }
    : { text: 'First snapshot. Trend will appear after a second observation.', source: dossier.source };
  const exposure = { text: risk.coverage + '% score coverage. ' + (signals.funding ? 'Disclosed financing dated ' + signals.funding.value.announced + '.' : 'Latest financing is unverified.'), source: signals.funding?.source || dossier.source };
  const question = { text: signals.jobs ? 'How do the ' + signals.jobs.value.count + ' public vacancies affect cash runway?' : 'What are current cash and monthly net burn?', source: signals.jobs?.source };
  return [change, exposure, question];
}

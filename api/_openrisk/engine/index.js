import { cities, curated } from './catalog.js';
import { score } from './score.js';
import { signal } from './enrich.js';
import snapshot from './snapshot.js';
import { verified } from './verified.js';

export { cities };
export const catalog = curated.map(company => {
  const data = snapshot[company.id] || {};
  const signals = {
    ...data,
    ...(company.founded ? { founded: signal(company.founded, company.source, 'scraped', 'medium', company.asOf) } : {}),
    ...verified[company.id],
  };
  const risk = score(signals);
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

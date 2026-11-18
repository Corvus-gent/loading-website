export const metrics = {
  revenue: { label:'Revenue', category:'Financial', unit:'money', aliases:'(?<!monthly recurring )revenue' },
  mrr: { label:'MRR', category:'Financial', unit:'money', aliases:'MRR|monthly recurring revenue' },
  burn: { label:'Net burn', category:'Financial', unit:'money', aliases:'monthly net burn|net burn|monthly burn|burn' },
  cash: { label:'Cash', category:'Financial', unit:'money', aliases:'cash balance|cash on hand|cash in bank|cash' },
  runway: { label:'Runway', category:'Financial', unit:'months', aliases:'cash runway|runway' },
  customers: { label:'Customers', category:'Commercial', unit:'count', aliases:'paying customers|customers|customer count' },
  pipeline: { label:'Pipeline', category:'Sales', unit:'money', aliases:'qualified pipeline|sales pipeline|pipeline value|pipeline' },
  headcount: { label:'Headcount', category:'Operational', unit:'count', aliases:'headcount|employees|team size|FTEs' },
};

export const samples = [
  {
    label: 'September investor update',
    period: '2026-09',
    text: 'Subject: September 2026 investor update\n\nHi all,\nSeptember closed with MRR of €82k. Revenue reached €95,000.\nCash balance is €720k and monthly net burn was €120k.\nPaying customers reached 64. Qualified pipeline stands at €415k.\nHeadcount is 22.\n\nOur enterprise pilot moved from discovery to procurement.\nThanks,\nThe founding team',
  },
  {
    label: 'October investor update',
    period: '2026-10',
    text: 'Subject: October 2026 investor update\n\nHi all,\nOctober closed with MRR of €91k. Revenue reached €104,000.\nCash on hand was €570k and monthly net burn was €125k.\nPaying customers reached 71. Qualified pipeline stands at €470k.\nHeadcount is 23.\n\nTwo new enterprise pilots went live. We are watching collections closely.\nThanks,\nThe founding team',
  },
];

export const validPeriod = period => typeof period === 'string' && /^20\d\d-(0[1-9]|1[0-2])$/.test(period);
const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];

export function extract(text, defaultPeriod) {
  const provided = text.match(new RegExp('\\b(' + months.join('|') + ')\\s+(20\\d\\d)\\b','i'));
  const iso = text.match(/\b20\d\d-(?:0[1-9]|1[0-2])\b/);
  const period = provided ? provided[2] + '-' + String(months.indexOf(provided[1].toLowerCase()) + 1).padStart(2, '0')
    : iso?.[0] || defaultPeriod;
  const sentences = text.split(/\n|(?<=[.!?])\s+/).map(row=>row.trim()).filter(Boolean);
  const proposals = [];
  for (const [metric, def] of Object.entries(metrics)) {
    // A metric name must precede its value, with at most one common linking verb.
    const pattern = new RegExp('\\b(?:'+def.aliases+')\\b\\s*(?:\\((EUR|USD|GBP)\\)\\s*)?(?:(?:was|were|is|at|of|reached|stands at|closed at|came in at)\\s*)?[:=]?\\s*(€|\\$|£|EUR|USD|GBP)?[ \\t]*(-?\\d[\\d,.]*(?:[ \u00a0\u202f]\\d{3}(?!\\d))*)(?:[ \\t]*([kmb])\\b)?(?:[ \\t]*(EUR|USD|GBP)\\b)?','i');
    const evidence = sentences.find(sentence=>pattern.test(sentence));
    const matched = evidence?.match(pattern);
    if (!matched) continue;
    const [, labelCurrency, mark, raw, suffix, after] = matched;
    let canonical = raw.replace(/[.,]+$/,'').replace(/\s/g,'');
    if (canonical.includes('.') && canonical.includes(',')) {
      canonical = canonical.lastIndexOf(',') > canonical.lastIndexOf('.') ? canonical.replace(/\./g,'').replace(',','.') : canonical.replace(/,/g,'');
    } else if (canonical.includes(',')) {
      canonical = /,\d{1,2}$/.test(canonical) ? canonical.replace(',','.') : canonical.replace(/,/g,'');
    } else if (canonical.includes('.') && /^-?\d{1,3}(?:\.\d{3})+$/.test(canonical) && !suffix) {
      canonical = canonical.replace(/\./g,'');
    }
    const unit = ({ '€':'EUR', '$':'USD', '£':'GBP' }[mark] || mark || labelCurrency || after)?.toUpperCase() || null;
    const value = Number(canonical) * ({ k:1e3, m:1e6, b:1e9 }[suffix?.toLowerCase()] || 1);
    if (!Number.isFinite(value) || Math.abs(value) > 1e12 || (def.unit === 'count' && !Number.isInteger(value))) continue;
    proposals.push({ metric, period, value, currency:def.unit === 'money' ? unit : null, evidence:evidence.slice(0, 400), confidence:provided && (def.unit !== 'money' || unit) ? 'high' : 'medium' });
  }
  return proposals;
}

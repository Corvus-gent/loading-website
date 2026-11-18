import { signal } from './enrich.js';

const reviewed = '2026-11-18';
export const verified = {
  'aikido-security': {
    location: signal('European headquarters in Gent', 'https://www.aikido.dev/company/europe-office', 'scraped', 'high', reviewed),
    headcount: signal({ label:'180 people at Series B announcement', detail:'Historical figure disclosed in the Series B announcement.' }, 'https://www.aikido.dev/blog/aikido-funding-series-b', 'scraped', 'high', reviewed),
    funding: signal({ label: '$60M Series B', announced: '2026-01-14' }, 'https://www.aikido.dev/blog/aikido-funding-series-b', 'scraped', 'high', reviewed),
  },
  deliverect: {
    enterprise: signal('0692.623.253', 'https://www.deliverect.com/en/terms-of-service', 'scraped', 'high', reviewed),
    location: signal('Registered office in Gent, Belgium', 'https://www.deliverect.com/en/terms-of-service', 'scraped', 'high', reviewed),
    founded: signal(2018, 'https://www.deliverect.com/en-us/about-us', 'scraped', 'high', reviewed),
    funding: signal({ label: 'Over $150M Series D', announced: '2022-01-25' }, 'https://www.deliverect.com/en-us/blog/deliverect/unicorn-status-series-d-funding-and-approaching-100m-orders-processed', 'scraped', 'high', reviewed),
  },
  'hippocratic-ai': {
    funding: signal({ label:'$126M Series C', announced:'2025-11-03' }, 'https://hippocraticai.com/hippocratic-ai-announces-series-c-funding-126-million/', 'scraped', 'high', reviewed),
  },
  uniphore: {
    funding: signal({ label:'$260M Series F', announced:'2025-10-22' }, 'https://www.uniphore.com/press-releases/nvidia-amd-snowflake-databricks-invest-in-uniphores-series-f/', 'scraped', 'high', reviewed),
    location: signal('Headquarters in Palo Alto', 'https://www.uniphore.com/contact/', 'scraped', 'high', reviewed),
  },
  'safe-superintelligence': {
    funding: signal({ label:'$1B disclosed financing', announced:'2024-09-04' }, 'https://ssi.inc/updates', 'scraped', 'high', reviewed),
  },
  stripe: {
    disclosure: signal({ label: '$1.9T processed in 2025', detail: 'Total 2025 volume across businesses on Stripe. Annual letter and secondary tender announcement.' }, 'https://stripe.com/newsroom/news/stripe-2025-update', 'scraped', 'high', reviewed),
  },
};

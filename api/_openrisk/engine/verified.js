import { signal } from './enrich.js';

const reviewed = '2026-11-18';
export const verified = {
  'aikido-security': {
    funding: signal({ label: '$60M Series B', announced: '2026-01-14' }, 'https://www.aikido.dev/blog/aikido-funding-series-b', 'scraped', 'high', reviewed),
  },
  deliverect: {
    founded: signal(2018, 'https://www.deliverect.com/en-us/about-us', 'scraped', 'high', reviewed),
    funding: signal({ label: 'Over $150M Series D', announced: '2022-01-25' }, 'https://www.deliverect.com/en-us/blog/deliverect/unicorn-status-series-d-funding-and-approaching-100m-orders-processed', 'scraped', 'high', reviewed),
  },
  stripe: {
    disclosure: signal({ label: '$1.9T processed in 2025', detail: 'Total 2025 volume across businesses on Stripe. Annual letter and secondary tender announcement.' }, 'https://stripe.com/newsroom/news/stripe-2025-update', 'scraped', 'high', reviewed),
  },
};

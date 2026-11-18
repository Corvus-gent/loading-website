import { signal } from './enrich.js';

const reviewed = '2026-11-18';
const evidence = (value, source) => signal(value,source,'scraped','high',reviewed);
const odooRelease = 'https://www.odoo.com/blog/odoo-news-5/odoo-s-a-announces-a-500-million-transaction-increasing-the-belgian-unicorn-s-valuation-to-5-billion-1508';
const aikidoOffices='https://www.aikido.dev/company/about';
const aikidoCareers='https://www.aikido.dev/company/careers';
const deliverectOffices='https://www.deliverect.com/en/careers';
const office = (city,country,label,source,kind='office') => ({city,country,label,source,kind});

export const verified = {
  'aikido-security': {
    locations:[
      office('Gent','Belgium','Main HQ','https://prtimes.jp/main/html/rd/p/000000001.000194415.html','primary'),
      office('San Francisco','United States','US headquarters (company About page)',aikidoOffices),
      office('Chicago','United States','US office',aikidoOffices),
      office('London','United Kingdom','UK office',aikidoOffices),
      office('Singapore','Singapore','APAC headquarters',aikidoOffices),
      office('Boston','United States','Defense headquarters',aikidoOffices),
      office('Austin','United States','Hiring location',aikidoCareers,'hiring'),
      office(null,'Japan','Market entry and local entity announced','https://prtimes.jp/main/html/rd/p/000000001.000194415.html','announced'),
    ],
    founders: evidence(['Willem Delbare','Roeland Delrue','Felix Garriau','Madeline Lawrence'], 'https://www.aikido.dev/company/about'),
    founded: evidence(2022, 'https://www.aikido.dev/company/about'),
    traction: evidence({ label:'150,000+ teams protected', detail:'Aikido’s own October 2026 press-kit disclosure.' }, 'https://www.aikido.dev/company/press-kit'),
    location: signal('European headquarters in Gent', 'https://www.aikido.dev/company/europe-office', 'scraped', 'high', reviewed),
    headcount: evidence({ label:'375+ employees', detail:'Aikido press kit, October 2026.' }, 'https://www.aikido.dev/company/press-kit'),
    funding: signal({ label: '$60M Series B', announced: '2026-01-14' }, 'https://www.aikido.dev/blog/aikido-funding-series-b', 'scraped', 'high', reviewed),
  },
  deliverect: {
    locations:[
      office('Gent','Belgium','Main HQ',deliverectOffices,'primary'),
      ...[
        ['Toronto','Canada'],['New York City','United States'],['London','United Kingdom'],['Madrid','Spain'],
        ['Paris','France'],['Amersfoort','Netherlands'],['Dubai','United Arab Emirates'],['Mexico City','Mexico'],
        ['Sydney','Australia'],['Glasgow','United Kingdom'],['Riyadh','Saudi Arabia'],['Copenhagen','Denmark'],
      ].map(([city,country])=>office(city,country,'Office',deliverectOffices)),
    ],
    founders: evidence(['Zhong Xu','Jan Hollez','Jelte Vrijhoef','Jérôme Laredo'], 'https://www.deliverect.com/en-us/about-us'),
    accounts: evidence({ entity:'Deliverect NV', scope:'Standalone Belgian filing', fiscalEnd:'2025-12-31',
      filedAt:'2026-07-16', reference:'2026-00308255', currency:'EUR',
      rows:[
        { label:'Turnover', code:'70', value:41193281 },
        { label:'Equity', code:'10/15', value:57313096 },
        { label:'Liquid assets', code:'54/58', value:25318587 },
        { label:'Average FTE', code:'9087', value:75.7 },
      ] }, 'https://consult.cbso.nbb.be/'),
    enterprise: signal('0692.623.253', 'https://www.deliverect.com/en/terms-of-service', 'scraped', 'high', reviewed),
    location: signal('Registered office in Gent, Belgium', 'https://www.deliverect.com/en/terms-of-service', 'scraped', 'high', reviewed),
    founded: signal(2018, 'https://www.deliverect.com/en-us/about-us', 'scraped', 'high', reviewed),
    funding: signal({ label: 'Over $150M Series D', announced: '2022-01-25' }, 'https://www.deliverect.com/en-us/blog/deliverect/unicorn-status-series-d-funding-and-approaching-100m-orders-processed', 'scraped', 'high', reviewed),
  },
  'safe-superintelligence': {
    locations:[
      office('Palo Alto','United States','Office','https://ssi.inc/'),
      office('Tel Aviv','Israel','Office','https://ssi.inc/'),
    ],
  },
  teamleader: {
    enterprise: evidence('0899.623.035', 'https://www.teamleader.eu/legal'),
    location: evidence('Registered office in Gent, Belgium', 'https://www.teamleader.eu/legal'),
    accounts: evidence({ entity:'Teamleader NV', scope:'Standalone Belgian filing', fiscalEnd:'2025-12-31',
      filedAt:'2026-04-23', reference:'2026-00085960', currency:'EUR',
      rows:[
        { label:'Turnover', code:'70', value:31259961.77 },
        { label:'Equity', code:'10/15', value:12860213.69 },
        { label:'Liquid assets', code:'54/58', value:12510357.35 },
        { label:'Average FTE', code:'9087', value:146.4 },
      ] }, 'https://consult.cbso.nbb.be/'),
  },
  showpad: {
    location: evidence('Headquarters in Chicago and Gent', 'https://www.showpad.com/press/showpad-and-bigtincan-announce-merger'),
    disclosure: evidence({ label:'Vector Capital acquisition', detail:'Showpad and Bigtincan merged in 2025. The combined company operates as Showpad.' }, 'https://www.showpad.com/about-us'),
    funding: evidence({ label:'$70M historical Series D', announced:'2019-06-25' }, 'https://www.showpad.com/press/page/4'),
  },
  lighthouse: {
    funding: evidence({ label:'Approximately $370M Series C', announced:'2024-11-21' }, 'https://www.mylighthouse.com/it/resources/blog/lighthouse-announces-370-million-series-c-investment-led-by-kkr-to-accelerate-platform-innovation-and-growth'),
  },
  robovision: {
    founded: evidence(2008, 'https://robovision.ai/about-us/history'),
    funding: evidence({ label:'$42M disclosed financing', announced:'2024-03-28' }, 'https://robovision.ai/resources/archive/news/robovision-secures-42m-funding'),
    corporateEvent: evidence({ label:'Leon van de Pas appointed CEO', date:'2025-10-01' }, 'https://robovision.ai/about-us/history'),
  },
  odoo: {
    founded: evidence(2002, odooRelease),
    disclosure: evidence({ label:'€500M secondary transaction', detail:'Announced November 2024. Existing investors sold part of their holdings.' }, odooRelease),
    location: evidence('Registered office in Grand-Rosière, Belgium', 'https://www.odoo.com/documentation/saas-18.4/odoo_partnership_agreement.pdf'),
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
  openai: {
    funding: evidence({ label:'$122B of committed capital', announced:'2026-03-31' }, 'https://openai.com/index/accelerating-the-next-phase-ai/'),
  },
  anthropic: {
    funding: evidence({ label:'$65B Series H', announced:'2026-05-28' }, 'https://www.anthropic.com/news/series-h'),
    corporateEvent: evidence({ label:'Roadshow launched for proposed public offering', date:'2026-11-10' }, 'https://www.anthropic.com/news/roadshow-launch'),
  },
  figma: {
    disclosure: evidence({ label:'$391.4M Q3 2026 revenue', detail:'Three months ended September 30, 2026. Reported growth was 43% year-over-year.' }, 'https://investor.figma.com/news-events/news/news-details/2026/Figma-Announces-Third-Quarter-2026-Financial-Results/'),
    corporateEvent: evidence({ label:'Initial public offering price announced', date:'2025-07-30' }, 'https://investor.figma.com/news-events/news/news-details/2025/Figma-Announces-Pricing-of-Initial-Public-Offering/default.aspx'),
  },
  notion: {
    disclosure: evidence({ label:'Approximately $270M private tender', detail:'Existing and former employees sold shares in a secondary transaction announced January 2026.' }, 'https://www.notion.com/blog/gic-sequoia-index-purchase-notion-shares'),
  },
  linear: {
    funding: evidence({ label:'$82M Series C, primary and secondary', announced:'2025-06-10' }, 'https://linear.app/now/building-our-way'),
    disclosure: evidence({ label:'$99M tender offer', detail:'Secondary liquidity for employees, announced August 2026.' }, 'https://linear.app/now/sharing-growth-with-the-people-building-linear'),
  },
  vercel: {
    funding: evidence({ label:'$300M Series F investment', announced:'2025-09-30' }, 'https://vercel.com/blog/series-f'),
  },
  'mistral-ai': {
    funding: evidence({ label:'€3B Series D', announced:'2026-09-08' }, 'https://mistral.ai/news/mistral-makes-sovereign-open-weight-ai-to-frontier/'),
  },
  stripe: {
    disclosure: signal({ label: '$1.9T processed in 2025', detail: 'Total 2025 volume across businesses on Stripe. Annual letter and secondary tender announcement.' }, 'https://stripe.com/newsroom/news/stripe-2025-update', 'scraped', 'high', reviewed),
  },
};

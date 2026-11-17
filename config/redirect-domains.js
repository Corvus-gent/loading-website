// Add apex domains here; www is generated automatically.
export const REDIRECT_DOMAINS = ['corvus.gg', 'corvus.ai', 'corvus.com'];
export const domainRedirects = REDIRECT_DOMAINS.flatMap(domain => [domain, `www.${domain}`].map(host => ({source: '/:path*', has: [{type: 'host', value: host}], destination: 'https://corvus.gent/:path*', statusCode: 301})));

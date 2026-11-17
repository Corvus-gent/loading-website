import fs from 'node:fs';
import {domainRedirects} from '../config/redirect-domains.js';
const file = 'vercel.json', config = JSON.parse(fs.readFileSync(file, 'utf8'));
config.redirects = [...domainRedirects, ...config.redirects.filter(rule => !rule.has?.some(item => item.type === 'host' && /^(www\.)?corvus\.(gg|ai|com)$/.test(item.value)))];
// Static sites serve public/ literally; expose the requested security.txt path explicitly.
config.rewrites = [{source: '/.well-known/security.txt', destination: '/public/.well-known/security.txt'}, ...config.rewrites.filter(rule => rule.source !== '/.well-known/security.txt')];
fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');

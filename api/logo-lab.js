import { connected, redis } from './_redis.js';

const editions = new Set(['prompt','legio','flyer','sigil','arcade']);

export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method !== 'POST') {
    res.setHeader('Allow','POST');
    return res.status(405).end();
  }
  const { slug, part = '' } = req.body || {};
  if(!editions.has(slug) || typeof part !== 'string' || part.length > 240) {
    return res.status(400).json({error:'Invalid pick'});
  }
  if(!connected()) return res.status(503).json({error:'Voting unavailable'});
  try {
    await redis(['XADD','corvus:logo-lab:v1','MAXLEN','~',10000,'*','slug',slug,'part',part.trim()]);
    return res.status(201).json({saved:true});
  } catch {
    return res.status(503).json({error:'Voting unavailable'});
  }
}

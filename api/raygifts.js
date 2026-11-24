import { catalog } from '../app/raygifts/catalog.js';
import { render } from '../app/raygifts/render.js';

export default async function handler(req, res) {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  const handle = typeof req.query.handle === 'string' ? req.query.handle : '';
  const path = handle ? '/' + encodeURIComponent(handle) : '';
  try {
    const { products, byHandle, currency } = await catalog();
    const product = byHandle.get(handle);
    const missing = !!handle && !product;
    res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(missing ? 404 : 200).setHeader('Content-Type', 'text/html; charset=utf-8').send(render({ products, currency, product, missing, path }));
  } catch (error) {
    console.error('Ray catalogue unavailable:', error.message);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).setHeader('Content-Type', 'text/html; charset=utf-8').send(render({
      products: [], currency: 'XXX', unavailable: true, path,
    }));
  }
}

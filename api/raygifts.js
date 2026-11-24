import { catalog } from '../app/raygifts/catalog.js';
import { render } from '../app/raygifts/render.js';
import { resultCode } from '../app/raygifts/ritual.js';
import { shareImage } from '../app/raygifts/share.js';

const cache = 'public, s-maxage=3600, stale-while-revalidate=86400';

export default async function handler(req, res) {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  const handle = typeof req.query.handle === 'string' ? req.query.handle : '';
  const mode = handle === 'quiz' || handle === 'box' ? handle : 'home';
  const result = resultCode(req.query.r);
  const path = handle ? '/' + encodeURIComponent(handle) : '';
  try {
    if (handle === 'share.png') {
      const image = await shareImage(result);
      return res.status(200).setHeader('Content-Type', 'image/png').setHeader('Vercel-CDN-Cache-Control', cache).send(image);
    }
    const { products, byHandle, currency } = await catalog();
    const product = mode === 'home' ? byHandle.get(handle) : undefined;
    if (product && product.handle !== handle) {
      res.setHeader('Location', '/raygifts/' + encodeURIComponent(product.handle));
      return res.status(307).end();
    }
    const missing = mode === 'home' && !!handle && !product;
    res.setHeader('Vercel-CDN-Cache-Control', cache);
    return res.status(missing ? 404 : 200).setHeader('Content-Type', 'text/html; charset=utf-8').send(render({
      products, currency, product, missing, path, mode, result: mode === 'quiz' ? result : '',
    }));
  } catch (error) {
    console.error('Ray request failed:', error.message);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).setHeader('Content-Type', 'text/html; charset=utf-8').send(render({
      products: [], currency: 'XXX', unavailable: true, path, mode, result: mode === 'quiz' ? result : '',
    }));
  }
}

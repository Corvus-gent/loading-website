import {readFile} from 'node:fs/promises';
import {redis} from '../_redis.js';
import {getSession} from '../_session.js';

const figures = new Map([
  ['Corvus', 'Black raven with a green eye'], ['Jester', 'Jester in a red and gold cap'],
  ['Diogenes', 'Figure reclining in a barrel beside a lantern'], ['Squawk', 'Green parrot wearing a pirate hat'],
  ['Whitney', 'White dog in profile'], ['Harrie', 'Seated grey dog'], ['Cubie', 'Spotted cube with feet'],
  ['Hex', 'Blue spider with a red band'], ['Moth', 'Moth with broad speckled wings'], ['Hoot', 'Owl with gold eyes'],
  ['Daemon', 'Small red figure holding a trident'], ['Herald', 'Winged figure sounding a trumpet'],
  ['Rook', 'Black bird carrying a sheet of paper'], ['Wisp', 'Green flame with a pale centre'],
  ['Pip', 'White die with black pips'], ['Gargoyle', 'Stone figure with outstretched wings']
]);
const key = 'court:held:v1:' + (process.env.VERCEL_ENV || 'local');
const termsVersion = 'court-2026-11-28';
const mailbox = 'hello@corvus.gent';

function reportLink(name) {
  const subject = 'Corvus Court rights enquiry' + (name ? ' — ' + name : '');
  const body = 'Page: https://corvus.gent/court' + (name ? '#' + name.toLowerCase() + '\nArtwork: ' + name : '') +
    '\n\nWork or mark concerned:\nMy relationship to the work:\nMy concern or requested change:\n';
  return 'mailto:' + mailbox + '?subject=' + encodeURIComponent(subject) + '&amp;body=' + encodeURIComponent(body);
}

function page(title, content) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#18131e"><title>${title} · Corvus</title>
  <link rel="icon" href="data:,"><link rel="stylesheet" href="/court/style.css"></head><body>
  <header><a class="wordmark" href="https://corvus.gent">corvus<span>.gent</span></a><span>STUDIO / THE COURT</span></header>
  <main>${content}</main></body></html>`;
}

const terms = `<section class="terms" id="rights"><h2>Rights &amp; page terms</h2>
  <p>The Court is an independent Corvus studio project. Disney, Nintendo and The Pokémon Company have no affiliation with this gallery and have not endorsed it. Third-party characters, artwork and trademarks belong to their respective rights holders. Viewing this gallery grants no licence to reuse their work. Your legal rights are unaffected.</p>
  <h3>From the studio</h3><p>I developed these sixteen portraits with Claude and Recraft. I’d love to talk to the Pokémon and Nintendo teams about a licensed collaboration. If you represent a studio or a creator whose work you recognise, my door is open. 😇 <span class="signature">— Gabe</span></p>
  <h3>Raise a concern</h3><p>Email <a href="${reportLink('')}">${mailbox}</a> or use “Report artwork” beside a portrait. Include the image name or URL, the work you represent and the change you’re requesting. I review reports personally and can hide a portrait while we clarify permission.</p>
  <p>If activated, the Corvus AI agent may flag objections from verified official rights-holder addresses and suggest a change. I decide whether to amend or remove the artwork.</p>
  <h3>Cookies on this page</h3><p>The gallery needs no cookies or tracking. The entry button acknowledges these page terms for this visit. <a href="https://corvus.gent/privacy/">Corvus privacy policy</a></p></section>`;

function entrance() {
  return page('Enter the Court', `<div class="entrance"><div class="intro"><p class="overline">Artist’s notice</p>
  <h1>Before you <br>enter<span>.</span></h1><p class="lede">Sixteen pixel portraits from Corvus. Please read the terms before stepping into the gallery.</p></div>
  <div>${terms}<form method="post" action="/court" class="enter"><label>
  <input type="checkbox" name="acknowledge" value="${termsVersion}" required> I have read and accept the page terms.</label>
  <button>Enter the gallery</button></form></div></div>`);
}

async function portrait([name, description]) {
  const id = name.toLowerCase();
  const image = await readFile(new URL(`./art/${id}.png`, import.meta.url));
  return `<li id="${id}"><figure><div class="portrait"><img alt="${description}" src="data:image/png;base64,${image.toString('base64')}"></div>
    <figcaption><h3>${name}</h3><a href="${reportLink(name)}" aria-label="Report a rights concern about ${name}">Report artwork</a></figcaption></figure></li>`;
}

async function gallery(held) {
  const displayed = [...figures].filter(([name]) => !held.has(name));
  const cards = await Promise.all(displayed.map(portrait));
  return page('The Court', `<div class="gallery-head"><div><p class="overline">The companions</p><h1>The Court<span>.</span></h1></div>
  <a href="#rights">Rights &amp; reporting</a></div>
  ${cards.length ? '<ul class="gallery">' + cards.join('') + '</ul>' : '<p>The gallery is temporarily empty.</p>'}
  <div class="gallery-terms">${terms}</div>`);
}

function management(held) {
  const rows = [...figures.keys()].map(name => {
    const hidden = held.has(name);
    return `<li><span>${name} · ${hidden ? 'Hidden' : 'Visible'}</span><form method="post" action="/court/manage">
      <input type="hidden" name="figure" value="${name}"><button name="action" value="${hidden ? 'restore' : 'hold'}">${hidden ? 'Restore' : 'Hide'} ${name}</button></form></li>`;
  });
  return page('Manage the Court', `<h1>Manage portraits<span>.</span></h1><p>Hiding a portrait removes it from new gallery views.</p><ul class="management">${rows.join('')}</ul>`);
}

function form(req) {
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/x-www-form-urlencoded') return {};
  return typeof req.body === 'string' ? Object.fromEntries(new URLSearchParams(req.body)) : req.body || {};
}

async function heldPortraits() {
  const members = await redis(['SMEMBERS', key]);
  if (!Array.isArray(members)) throw new Error('Gallery availability unknown');
  return new Set(members);
}

export default async function court(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'self'; img-src data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  if (!['GET', 'HEAD', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD, POST');
    return res.status(405).end();
  }
  try {
    if (req.query.court === 'manage') {
      if ((await getSession(req))?.email !== 'gabriel@corvus.gent') {
        return res.status(403).send(page('Owner sign-in', '<h1>Owner access</h1><p><a href="/music/admin/">Sign in to Corvus</a>, then return to this page.</p>'));
      }
      if (req.method === 'POST') {
        const {figure, action} = form(req);
        const origin = req.headers.origin;
        const expectedOrigin = 'https://' + req.headers.host;
        if (origin !== expectedOrigin) return res.status(403).end();
        if (!figures.has(figure) || !['hold','restore'].includes(action)) return res.status(400).end();
        await redis([action === 'hold' ? 'SADD' : 'SREM', key, figure]);
        res.setHeader('Location', '/court/manage');
        return res.status(303).end();
      }
      if (req.method === 'HEAD') return res.status(200).end();
      return res.status(200).send(management(await heldPortraits()));
    }
    if (req.method === 'HEAD') return res.status(200).end();
    if (req.method === 'GET') return res.status(200).send(entrance());
    if (form(req).acknowledge !== termsVersion) return res.status(400).send(entrance());
    return res.status(200).send(await gallery(await heldPortraits()));
  } catch {
    return res.status(503).send(page('Court unavailable', `<h1>The gallery is temporarily closed.</h1><p>For rights enquiries, email <a href="${reportLink('')}">${mailbox}</a>.</p>`));
  }
}

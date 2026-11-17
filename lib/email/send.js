import {senderIdentity} from './addresses.js';
const unsubscribeOrigins = new Set(['https://corvus.gent']);
export function emailConfigured(env = process.env) {
  if (env.RESEND_API_KEY) return true;
  if (env.VERCEL_ENV === 'preview') {
    console.warn('[email] RESEND_API_KEY missing in preview; delivery skipped');
    return false;
  }
  throw Error('[email] RESEND_API_KEY is required');
}
export function prepareEmail(stream, {to, subject, text, html, unsubscribeUrl}, env = process.env) {
  if (!to || !subject || (!text && !html)) throw Error('Email requires to, subject and content');
  const message = {to, subject, ...(text ? {text} : {}), ...(html ? {html} : {}), ...senderIdentity(stream, env), tags: [{name: 'stream', value: stream}]};
  if (stream === 'marketing') {
    const url = new URL(unsubscribeUrl);
    if (!unsubscribeOrigins.has(url.origin) || url.username || url.password || /[<>\r\n]/.test(unsubscribeUrl) ||
        url.pathname !== '/api/army' || !url.searchParams.get('unsubscribe')) throw Error('Marketing requires a working Corvus unsubscribe endpoint');
    // Endpoint supports both GET and RFC 8058 one-click POST without a session.
    message.headers = {'List-Unsubscribe': `<${url.href}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'};
    message.text = (text || '').includes(`Unsubscribe: ${url.href}`) ? text : (text || '') + `\n\nUnsubscribe: ${url.href}`;
    const footer = `<p><a href="${url.href.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">Unsubscribe</a></p>`;
    if (html && !html.endsWith(footer)) message.html = html + footer;
  }
  return message;
}
export async function sendPrepared(messages, {request = fetch, env = process.env, idempotencyKey, batch = false, throwOnError = true} = {}) {
  if (!emailConfigured(env)) return {ok: false, skipped: true, status: 0};
  const response = await request('https://api.resend.com/emails' + (batch ? '/batch' : ''), {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
    headers: {Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', ...(idempotencyKey ? {'Idempotency-Key': idempotencyKey} : {})},
    body: JSON.stringify(messages),
  });
  if (!response.ok && throwOnError) throw Error(`[email] Resend rejected delivery (${response.status})`);
  return response;
}
export function sendTransactional(message, options = {}) { return sendPrepared(prepareEmail('transactional', message, options.env), options); }
export function sendMarketing(message, options = {}) { return sendPrepared(prepareEmail('marketing', message, options.env), options); }

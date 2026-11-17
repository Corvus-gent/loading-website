export const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
export function template(title, body, url, label) {
  const link = new URL(url);
  if (link.origin !== 'https://corvus.gent') throw Error('Email links must use the primary Corvus domain');
  return {subject: title, text: `${title}\n\n${body}\n\n${label}: ${link.href}`, html: `<main style="background:#111;color:#ddd;padding:32px;font:16px monospace"><p style="color:#ffd76a">corvus ↟</p><h1>${escape(title)}</h1><p>${escape(body)}</p><a style="color:#ffd76a" href="${escape(link.href)}">${escape(label)} →</a></main>`};
}

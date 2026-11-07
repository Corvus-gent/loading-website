import { t } from './i18n.js?v=20261106-ranks1';
export const genres = ['us hip-hop','rap fr','rap nl/be','latin','lusophone','afro','pop 00s','electronic','rock','classics','soundtrack','funk & phonk'];
export const $ = id => document.getElementById(id);
export const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const label = key => esc(t(key));
export const norm = value => String(value).normalize('NFKD').replace(/\p{Diacritic}/gu,'').toLowerCase();
export function providers(track) {
  const query=encodeURIComponent(`${track.title} ${track.artist || ''}`.trim());
  const spotify = /^[A-Za-z0-9]{22}$/.test(track.spotifyId || '') ? `https://open.spotify.com/track/${track.spotifyId}` : null;
  let apple=null;
  try {const u=new URL(track.appleUrl); if(u.protocol==='https:' && u.hostname==='music.apple.com' && !u.username && !u.password && !u.port) apple=u.href;} catch {}
  return [
    {name:'Spotify',url:spotify || `https://open.spotify.com/search/${query}`,direct:!!spotify},
    {name:'Apple Music',url:apple || `https://music.apple.com/be/search?term=${query}`,direct:!!apple},
    {name:'Bandcamp',url:`https://bandcamp.com/search?q=${query}`,direct:false},
    {name:'SoundCloud',url:`https://soundcloud.com/search/sounds?q=${query}`,direct:false},
    {name:'MusicBrainz',url:`https://musicbrainz.org/search?query=${query}&type=recording&method=indexed`,direct:false},
  ];
}
export function linksHTML(track) {
  return `<details class="song-links"><summary aria-label="${label('m.links')}">↗ <span>${label('m.links')}</span></summary><div class="link-menu">${providers(track).map(p=>`<div><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${p.direct?'':`${label('m.searchOn')} `}${p.name} ↗</a><button type="button" class="copy-link" data-url="${esc(p.url)}" aria-label="${label('m.copy')} · ${p.name}">⧉</button></div>`).join('')}<button type="button" class="share-song" data-id="${esc(track.id)}">${label('m.share')} ↗</button></div></details>`;
}
export async function copyLink(url) {
  try {await navigator.clipboard.writeText(url);} catch {
    const input=document.createElement('textarea'); input.value=url; document.body.append(input); input.select();
    const copied=document.execCommand('copy'); input.remove(); if(!copied) throw new Error('copy failed');
  }
}
export function errorText(code) {
  const keys={conflict:'m.conflict',invalid_link:'m.invalidLink',unknown_track:'m.invalidLink',already_listed:'m.alreadyListed',daily_limit:'m.dailyLimit',cooldown:'m.wait',rate_limited:'m.wait',box_full:'m.full',forbidden:'m.forbidden',login_required:'m.loginHint',challenge_expired:'m.challenge',storage_unavailable:'m.offline',storage_error:'m.offline'};
  return t(keys[code] || 'm.error');
}
export async function request(url,body) {
  const response=await fetch(url,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'same-origin'}:{cache:'no-store',credentials:'same-origin'});
  const data=await response.json();
  if(!response.ok) throw Object.assign(new Error(errorText(data.error)),{data,status:response.status});
  return data;
}

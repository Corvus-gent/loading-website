import {providers} from '../music-shared.js';

const STORAGE_KEY = 'corvus-realm-theme';
// Replace with Gabe’s Spotify profile or playlist when available.
const SPOTIFY_PROFILE_PLACEHOLDER = 'https://open.spotify.com/';

const root = document.documentElement;
const themePanel = document.getElementById('realm-theme');
const music = document.getElementById('realm-music');
const systemTheme = matchMedia('(prefers-color-scheme: light)');
const swatches = [...themePanel.querySelectorAll('button[value]')];
const custom = themePanel.querySelector('input[type=color]');
const validColour = value => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
let saved;
try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch {}
let mode = ['dark', 'light'].includes(saved?.mode) ? saved.mode : null;
let accent = validColour(saved?.accent) ? saved.accent : '#ffd76a';

const channels = hex => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
const luminance = rgb => rgb.reduce((sum, channel, index) => {
  const n = channel / 255;
  return sum + [0.2126, 0.7152, 0.0722][index] * (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
}, 0);

function readableAccent(hex, light) {
  const against = luminance(channels(light ? '#eee5db' : '#241b30'));
  const source = channels(hex);
  const target = light ? 0 : 255;
  for (let step = 0; step <= 100; step++) {
    const rgb = source.map(channel => Math.round(channel + (target - channel) * step / 100));
    const luma = luminance(rgb);
    const contrast = (Math.max(luma, against) + 0.05) / (Math.min(luma, against) + 0.05);
    if ((light ? luma < against : luma > against) && contrast >= 4.5) return 'rgb(' + rgb.join(' ') + ')';
  }
}

function apply() {
  const effective = mode ?? (systemTheme.matches ? 'light' : 'dark');
  root.dataset.realmTheme = effective;
  root.style.setProperty('--realm-accent', readableAccent(accent, effective === 'light'));
  themePanel.querySelector('input[value="' + effective + '"]').checked = true;
  custom.value = accent;
  for (const button of swatches) button.setAttribute('aria-pressed', String(button.value === accent));
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({mode, accent})); } catch {}
}

themePanel.addEventListener('change', event => {
  if (event.target.name === 'realm-theme') mode = event.target.value;
  else if (event.target === custom) accent = custom.value;
  else return;
  apply();
  save();
});
for (const button of swatches) button.addEventListener('click', () => {
  accent = button.value;
  apply();
  save();
});
systemTheme.addEventListener('change', apply);
apply();

const player = music.querySelector('[data-realm-player]');
const list = music.querySelector('[data-realm-tracks]');
music.querySelector('[data-suggest-song]').href = SPOTIFY_PROFILE_PLACEHOLDER;
let loaded = false;
music.addEventListener('toggle', async event => {
  if (event.newState === 'closed') {
    player.replaceChildren();
    return;
  }
  if (loaded) return;
  loaded = true;
  try {
    const response = await fetch('/music.json');
    if (!response.ok) throw new Error('Music catalogue unavailable');
    const {tracks} = await response.json();
    for (const track of tracks.slice(0, 10)) {
      const [spotify, apple] = providers(track);
      const label = [track.title, track.artist].filter(Boolean).join(' · ');
      const item = document.createElement('li');
      if (spotify.direct || apple.direct) {
        const play = document.createElement('button');
        play.type = 'button';
        play.textContent = label;
        play.addEventListener('click', () => {
          const frame = document.createElement('iframe');
          const url = new URL(spotify.direct ? spotify.url : apple.url);
          if (spotify.direct) url.pathname = '/embed' + url.pathname;
          else url.hostname = 'embed.music.apple.com';
          frame.src = url.href;
          frame.title = label;
          frame.height = spotify.direct ? 152 : 175;
          frame.allow = 'encrypted-media';
          player.replaceChildren(frame);
        });
        item.append(play);
      } else {
        const link = document.createElement('a');
        link.href = spotify.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = label + ' ↗';
        item.append(link);
      }
      list.append(item);
    }
  } catch {
    const item = document.createElement('li');
    item.textContent = 'Songs are temporarily unavailable.';
    list.append(item);
  }
});

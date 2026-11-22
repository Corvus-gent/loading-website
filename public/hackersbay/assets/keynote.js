const video = document.querySelector('#keynote-video');
const sound = document.querySelector('#keynote-sound');
const mobile = matchMedia('(max-width: 640px)');
const compact = matchMedia('(max-width: 420px)');
const media = 'https://github.com/Corvus-gent/the-hackers-bay/releases/download/compound-keynote-v1';
const art = '/public/hackersbay/art/keynote';
const params = new URLSearchParams(location.search);
const playLive = document.querySelector('#keynote-play-live');
const deck = document.querySelector('#deck');
let currentLayout;
let live = false;

function setVideo() {
  const orientation = mobile.matches ? 'vertical' : 'wide';
  const layout = mobile.matches && compact.matches ? 'mobile' : orientation;
  if (layout === currentLayout) return;
  const time = video.currentTime;
  const resume = (!currentLayout || !video.paused) && !live;
  currentLayout = layout;
  video.poster = art + (mobile.matches ? '/keynote_poster_vertical.jpg' : '/keynote_poster.jpg');

  const formats = [
    [`keynote_${orientation}.mp4`, 'video/mp4'],
    [`keynote_${orientation}.webm`, 'video/webm']
  ];
  if (layout === 'mobile') formats.unshift(['keynote_mobile_720p.mp4', 'video/mp4']);
  const sources = formats.map(([file, type]) => {
    const source = document.createElement('source');
    source.src = `${media}/${file}`;
    source.type = type;
    return source;
  });
  const track = document.createElement('track');
  track.kind = 'captions';
  track.label = 'English';
  track.srclang = 'en';
  track.src = `${art}/keynote_${orientation}.vtt`;
  track.default = true;

  video.autoplay = resume;
  video.replaceChildren(...sources, track);
  track.track.mode = 'showing';
  video.addEventListener('loadedmetadata', () => {
    if (time > 0 && time < video.duration) video.currentTime = time;
  }, { once: true });
  video.load();
  if (resume) video.play().catch(() => {});
}

function updateSound() {
  const quiet = video.muted || video.volume === 0;
  sound.textContent = quiet ? '▶ Sound on' : 'Mute sound';
}
sound.addEventListener('click', () => {
  const quiet = video.muted || video.volume === 0;
  video.muted = !quiet;
  if (quiet) {
    if (video.volume === 0) video.volume = 1;
    video.play().catch(() => {});
  }
});
video.addEventListener('volumechange', updateSound);

async function openLive() {
  if (live) return;
  live = true;
  video.pause();
  video.autoplay = false;
  deck.hidden = false;
  playLive.hidden = true;
  document.documentElement.dataset.format =
    params.get('format') || (mobile.matches ? 'vertical' : 'wide');
  try {
    await import('./demo.js');
  } catch {
    deck.hidden = true;
    playLive.hidden = false;
    playLive.textContent = 'Could not load. Reload this page to retry.';
    return;
  }
  deck.scrollIntoView({ block: 'center' });
  deck.focus({ preventScroll: true });
}
playLive.addEventListener('click', openLive);
if (params.has('format') || location.hash === '#play-live') openLive();
mobile.addEventListener('change', setVideo);
compact.addEventListener('change', setVideo);
setVideo();

const linkedin = document.querySelector('#keynote-linkedin');
const status = document.querySelector('#keynote-share-status');
linkedin.addEventListener('click', async () => {
  const copy = linkedin.dataset.share;
  try {
    await navigator.clipboard.writeText(copy);
    status.textContent = 'Caption copied for LinkedIn.';
  } catch {
    status.textContent = copy;
  }
});

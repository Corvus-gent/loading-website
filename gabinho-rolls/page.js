const video=document.getElementById('brand-partner');
if(video){
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  if(motion.matches){video.autoplay=false;video.pause();}
  // Keep the muted loop quiet and pause it when the viewer leaves the page.
  document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause();});
}

const button=document.getElementById('load-tiktok'),container=document.getElementById('tiktok-profile'),status=document.getElementById('tiktok-status');
button.hidden=false;
button.addEventListener('click',()=>{
  if(button.disabled)return;
  button.disabled=true;status.textContent='Loading the latest edits…';
  // TikTok's creator-profile document; avoids its currently broken embed.js CDN loader.
  const frame=document.createElement('iframe');
  frame.src='https://www.tiktok.com/embed/@gabinho_bjj';frame.title='Latest TikTok edits by Gabinho';frame.className='tiktok-creator';frame.width='780';frame.height='540';frame.allow='autoplay; fullscreen';frame.referrerPolicy='no-referrer';
  const timer=setTimeout(()=>{status.textContent='TikTok is taking a while. Open @gabinho_bjj above if it is blocked in your browser.';button.disabled=false;button.textContent='Reload TikTok edits ↗';},12000);
  frame.addEventListener('load',()=>{clearTimeout(timer);status.textContent='If TikTok limits playback here, open @gabinho_bjj above.';button.hidden=true;},{once:true});
  frame.addEventListener('error',()=>{clearTimeout(timer);container.replaceChildren();status.textContent='TikTok could not load here. Open @gabinho_bjj above to watch the latest edits.';button.disabled=false;button.textContent='Try loading TikTok again ↗';},{once:true});
  container.replaceChildren(frame);
});

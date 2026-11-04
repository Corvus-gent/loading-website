import {limitedDevice,INITIAL_TRACKS,TRACK_BATCH} from './music-performance.js';
import {initI18n,t} from './i18n.js';
import {$,esc,label,norm,genres,providers,linksHTML,copyLink,request} from './music-shared.js';
let state={tracks:[],suggestions:[],votes:{},mine:[],poll:{spotify:0,apple:0},storage:false};
let genre='',onlyLiked=false,current=null,shuffle=false,queue=[],busy=false,deadline=0,controller=null,spotifyAPI=null,spotifyReady=false,playbackEnded=false;
let mapView=false,atlas=null,atlasLoading=null,trackLimit=INITIAL_TRACKS,suggestionLimit=INITIAL_TRACKS;
const lightDevice=limitedDevice(navigator);
$('device-tip').hidden=!lightDevice;
$('dismiss-device-tip').onclick=()=>{$('device-tip').hidden=true;};
async function setView(map){
  mapView=map;const url=new URL(location.href);if(map)url.searchParams.set('view','map');else url.searchParams.delete('view');history.replaceState(null,'',url);
  $('genre-atlas').hidden=!map;$('list-view').hidden=map;
  $('view-map').setAttribute('aria-pressed',String(map));$('view-list').setAttribute('aria-pressed',String(!map));
  if(map&&!atlas){
    try {
      atlasLoading ||= import('./music-map.js');
      const {createMusicMap}=await atlasLoading;
      if(!mapView)return;
      atlas ||= createMusicMap($('genre-atlas'),{chooseGenre(value,showList){genre=value;trackLimit=INITIAL_TRACKS;if(showList)setView(false);render();},playTrack:play});
    } catch {atlasLoading=null;setView(false);msg(t('m.error'));return;}
  }
  render();
}
$('view-list').onclick=()=>setView(false);$('view-map').onclick=()=>setView(true);
$('load-tracks').onclick=()=>{trackLimit+=TRACK_BATCH;render();};
$('collapse-tracks').onclick=()=>{trackLimit=INITIAL_TRACKS;render();$('collection-title').scrollIntoView({block:'start'});};
$('load-suggestions').onclick=()=>{suggestionLimit+=TRACK_BATCH;render();};
$('suggest-bird').onclick=event=>{event.preventDefault();const target=$('suggest-a-banger');target.scrollIntoView({behavior:lightDevice||matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});target.focus({preventScroll:true});};
const msg=text=>{$('notice').textContent=text || '';};
function visible() {
  const query=norm($('search').value.trim()),mine=new Set(state.mine);
  let tracks=state.tracks.filter(track=>(!genre || track.genre===genre) && (!onlyLiked || mine.has(track.id)) && (!query || norm(`${track.title} ${track.artist}`).includes(query)));
  if($('sort').value==='popular') tracks.sort((a,b)=>(state.votes[b.id]||0)-(state.votes[a.id]||0));
  if($('sort').value==='latest') tracks.sort((a,b)=>String(b.added||'').localeCompare(String(a.added||'')));
  return tracks;
}
function row(track,index,suggestion=false) {
  const mine=state.mine.includes(track.id),votes=state.votes[track.id]||0;
  const rank=suggestion?index+1:state.tracks.findIndex(t=>t.id===track.id)+1;
  return `<li class="track-row${track.id===current?' current':''}" data-track="${esc(track.id)}" id="song-${esc(track.id)}"><span class="track-rank">${rank}</span><div class="track-info"><button type="button" class="track-title" data-play="${esc(track.id)}">${esc(track.title)}</button><small>${esc(track.artist || t('m.unknown'))}${track.needsReview?`<span class="review-label">${label('m.review')}</span>`:''}</small>${track.note?`<details class="song-note"><summary>${label('m.fact')}</summary><p>${esc(track.note)}</p></details>`:''}</div><span class="genre-tag">${esc(track.genre||'')}</span><button type="button" class="like${mine?' mine':''}" data-vote="${esc(track.id)}" aria-label="${label(mine?'m.likedTrack':'m.like')} · ${esc(track.title)}" aria-pressed="${mine}" ${mine||busy||!state.storage?'disabled':''}>${mine?'♥':'♡'} <span>${votes}</span></button>${linksHTML(track)}</li>`;
}
function renderShuffle() {
  $('shuffle').setAttribute('aria-checked',String(shuffle));
  $('shuffle-label').textContent=t(shuffle?'m.shuffleOn':'m.shuffleOff');
}
function render() {
  renderShuffle();
  const list=visible();
  $('total').textContent=state.tracks.length;
  $('visible-count').textContent=`${mapView?list.length:Math.min(trackLimit,list.length)} / ${list.length}`;
  $('loaded-count').textContent=mapView?'':`${Math.min(trackLimit,list.length)} / ${list.length}`;
  $('load-tracks').hidden=mapView||trackLimit>=list.length;
  $('load-tracks').textContent=t(trackLimit===INITIAL_TRACKS?'m.openTracks':'m.moreTracks');
  $('collapse-tracks').hidden=mapView||trackLimit<=INITIAL_TRACKS;
  $('tracks').innerHTML=mapView?'':list.slice(0,trackLimit).map((track,i)=>row(track,i)).join('');
  $('empty').hidden=!!list.length;
  $('genres').innerHTML=[['',t('m.all')],...genres.map(g=>[g,g])].map(([value,name])=>`<button type="button" data-genre="${esc(value)}" class="${genre===value?'active':''}" aria-pressed="${genre===value}">${esc(name)}<small>${value?state.tracks.filter(t=>t.genre===value).length:state.tracks.length}</small></button>`).join('');
  const suggestions=state.suggestions.filter(s=>!state.tracks.some(t=>t.id===s.id)).sort((a,b)=>(state.votes[b.id]||0)-(state.votes[a.id]||0));
  $('suggestions').innerHTML=suggestions.length?suggestions.slice(0,suggestionLimit).map((track,i)=>row(track,i,true)).join(''):`<li class="empty">${label('music.empty')}</li>`;
  $('load-suggestions').hidden=suggestions.length<=suggestionLimit;
  for(const service of ['spotify','apple']) {
    const button=document.querySelector(`[data-poll="${service}"]`);
    $(service+'-count').textContent=state.poll[service]||0;
    button.disabled=!!state.poll.mine||busy||!state.storage;
    button.classList.toggle('selected',state.poll.mine===service);
    button.setAttribute('aria-pressed',String(state.poll.mine===service));
  }
  const total=(state.poll.spotify||0)+(state.poll.apple||0);
  $('poll-meter').style.width=`${total?Math.round(state.poll.spotify/total*100):50}%`;
  $('poll-total').textContent=`${total} ${t('m.votes')}`;
  $('liked-filter').setAttribute('aria-pressed',String(onlyLiked));
  if(mapView&&atlas)atlas.update(state.tracks,list,genre);
  rebuildQueue(); tick();
}
function rebuildQueue() {
  queue=visible().map(track=>track.id);
  if(shuffle) for(let i=queue.length-1;i>0;i--) {const j=Math.floor(Math.random()*(i+1)); [queue[i],queue[j]]=[queue[j],queue[i]];}
}
function trackById(id) {return state.tracks.find(t=>t.id===id)||state.suggestions.find(t=>t.id===id);}
function closePlayer() {controller?.destroy?.();controller=null;spotifyReady=false;$('embed').replaceChildren();$('player-links').replaceChildren();$('close-player').hidden=true;}
async function play(id) {
  const track=trackById(id); if(!track) return;
  current=id; playbackEnded=false;
  window.posthog?.capture("music_play",{genre:track.genre});
  $('now-title').textContent=track.title; $('now-artist').textContent=track.artist || t('m.unknown');
  document.querySelectorAll('.track-row').forEach(el=>el.classList.toggle('current',el.dataset.track===id));
  const links=providers(track), spotify=links[0],apple=links[1];
  if(spotify.direct) {
    if(controller && spotifyReady) {controller.loadUri(`spotify:track:${track.spotifyId}`);controller.play();}
    else {
      closePlayer();const selected=id;
      try {
        const API=await getSpotify();
        if(current!==selected) return;
        const host=document.createElement('div');$('embed').append(host);
        API.createController(host,{uri:`spotify:track:${track.spotifyId}`,width:'100%',height:80},c=>{
          if(current!==selected){c.destroy();return;}
          controller=c;
          c.addListener('ready',()=>{spotifyReady=true;c.play();});
          c.addListener('playback_update',event=>{const {isPaused,position,duration}=event.data; if(!isPaused && duration>0 && position>=duration-300 && !playbackEnded){playbackEnded=true;next();}});
        });
      } catch {msg(t('m.playerLimits'));}
    }
  } else if(apple.direct) {
    closePlayer();
    const url=new URL(apple.url);url.hostname='embed.music.apple.com';url.searchParams.set('theme','dark');
    const frame=document.createElement('iframe');frame.src=url.href;frame.title=`${track.title} · Apple Music`;frame.allow='autoplay; encrypted-media';frame.height='175';frame.style.height='175px';frame.loading='lazy';$('embed').append(frame);
  } else {closePlayer();$('now-artist').textContent=`${track.artist || t('m.unknown')} · ${t('m.review')}`;}
  $('player-links').innerHTML=links.slice(0,2).map(p=>`<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${p.direct?'':`${label('m.searchOn')} `}${p.name} ↗</a>`).join('');
  $('close-player').hidden=false;
}
function getSpotify() {
  if(spotifyAPI)return spotifyAPI;
  spotifyAPI=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{spotifyAPI=null;reject(new Error('player unavailable'));},15000);
    window.onSpotifyIframeApiReady=API=>{clearTimeout(timer);resolve(API);};
    const script=document.createElement('script');script.src='https://open.spotify.com/embed/iframe-api/v1';script.onerror=()=>{clearTimeout(timer);spotifyAPI=null;reject(new Error('player unavailable'));};document.body.append(script);
  });
  return spotifyAPI;
}
function next() {if(queue.length) play(queue[(queue.indexOf(current)+1)%queue.length]);}
function tick() {
  const remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));
  $('countdown').textContent=remaining?`⏱ ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`:'';
  $('suggest-button').disabled=busy||remaining>0||!state.storage;
  $('suggest-button').textContent=t(busy?'m.working':'music.send');
}
function update(data) {state={...state,...data};deadline=Date.now()+(data.retryAfter||0)*1000;render();}
async function solve(challenge) {
  const nonce=await new Promise((resolve,reject)=>{
    const worker=new Worker('/js/music-proof.js');
    const timer=setTimeout(()=>{worker.terminate();reject(new Error(t('m.challenge')));},120000);
    worker.onmessage=({data})=>{clearTimeout(timer);worker.terminate();data.error?reject(new Error(t('m.challenge'))):resolve(data.nonce);};
    worker.onerror=()=>{clearTimeout(timer);worker.terminate();reject(new Error(t('m.error')));};
    worker.postMessage(challenge);
  });
  const wait=challenge.notBefore-Date.now();if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));
  return nonce;
}
async function send(body) {
  if(busy||!state.storage)return;
  busy=true;render();msg(t('m.working'));
  try {
    const {challenge}=await request(`/api/music?challenge=${body.action}`);
    const nonce=await solve(challenge);
    const data=await request('/api/music',{...body,challenge:challenge.id,nonce});
    update(data);msg(t(body.action==='suggest'?'m.suggested':'m.voted'));
    if(body.action==='suggest')$('song-url').value='';
  } catch(error) {
    if(error.data?.retryAfter)deadline=Date.now()+error.data.retryAfter*1000;
    msg(error.message || t('m.error'));
  } finally {busy=false;render();}
}
document.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.play)play(button.dataset.play);
  if(button.dataset.vote)send({action:'vote',id:button.dataset.vote});
  if(button.dataset.poll)send({action:'poll',choice:button.dataset.poll});
  if('genre' in button.dataset){genre=button.dataset.genre;trackLimit=INITIAL_TRACKS;render();}
  if(button.classList.contains('copy-link')) {
    try {await copyLink(button.dataset.url);msg(t('m.copied'));}catch{msg(t('m.error'));}
  }
  if(button.classList.contains('share-song')) {
    const track=trackById(button.dataset.id),url=new URL('/music/',location.origin);url.hash=`track=${track.id}`;
    try {if(navigator.share) await navigator.share({title:`${track.title} · ${track.artist}`,url:url.href});else{await copyLink(url.href);msg(t('m.copied'));}}catch(error){if(error.name!=='AbortError')msg(t('m.error'));}
  }
});
$('sort').onchange=()=>{trackLimit=INITIAL_TRACKS;render();};
let searchTimer;
$('search').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{trackLimit=INITIAL_TRACKS;render();},150);};
$('liked-filter').onclick=()=>{onlyLiked=!onlyLiked;trackLimit=INITIAL_TRACKS;render();};
$('shuffle').onclick=()=>{shuffle=!shuffle;renderShuffle();rebuildQueue();};
$('play-all').onclick=()=>{if(queue.length)play(queue[0]);};$('next').onclick=next;
$('close-player').onclick=()=>{closePlayer();current=null;$('now-title').textContent=t('m.choose');$('now-artist').textContent=t('m.playerHint');render();};
$('suggest').onsubmit=event=>{event.preventDefault();send({action:'suggest',url:$('song-url').value,website:event.target.elements.website.value});};
initI18n(()=>{render();$('close-player').setAttribute('aria-label',t('m.close'));});
setInterval(tick,1000);
try {
  update(await request('/api/music'));
  if(!state.storage)msg(t('m.offline'));
} catch {
  try {const data=await request('/music.json');update({...data,storage:false});msg(t('m.offline'));}catch{msg(t('m.error'));}
}
function focusShared() {
  const id=new URLSearchParams(location.hash.slice(1)).get('track');
  const track=trackById(id);if(!track)return;
  $('search').value=track.title;genre='';onlyLiked=false;trackLimit=INITIAL_TRACKS;setView(false);render();
  document.getElementById(`song-${id}`)?.scrollIntoView({block:'center'});
}
focusShared();window.addEventListener('hashchange',focusShared);
if(new URLSearchParams(location.search).get('view')==='map'&&!lightDevice){await setView(true);$('genre-atlas').scrollIntoView({block:'start'});}

const artistQuery=new URLSearchParams(location.search).get('artist');if(artistQuery){$('search').value=artistQuery;render();}

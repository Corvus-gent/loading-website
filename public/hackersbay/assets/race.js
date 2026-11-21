import { artPicture, classArt } from './art.js';
import { loadCrew, crewAvatar, element } from './event-data.js';
import { getPersona, EVENT_PATH } from './persona.js';
import { describeMatch } from './lens.js';
import { FEATHER_KEY, prepareScout, raceScore, SCOUTS, rankRaceCandidates } from './race-model.js';
import { startRaceScene } from './race-scene.js';

const form = document.querySelector('#race-form');
const start = form.querySelector('button');
const lanes = document.querySelector('#race-lanes');
const status = document.querySelector('#race-status');
const winner = document.querySelector('#race-winner');
const log = document.querySelector('#race-log');
const racers = Object.entries(SCOUTS);
let stopScene;

function say(words) {
  const line = element('li',words);
  log.append(line);
  log.scrollTop=log.scrollHeight;
}

function racerLane(type,scout) {
  const card = element('article',undefined,'panel scout-lane');
  card.dataset.scout=type;
  card.dataset.state='ready';
  const title=element('div');
  title.append(element('h2',scout.name,'small-heading'),element('p',scout.focus,'fine'));
  const header=element('header');
  header.append(artPicture(classArt(type),{lazy:false}),title);
  const phase=element('p','On deck','scout-phase');
  phase.setAttribute('role','status');
  const track=element('div',undefined,'scout-track');
  track.setAttribute('aria-hidden','true');
  track.append(element('span'));
  const list=element('ol',undefined,'scout-picks');
  const choose=element('button','Pick '+scout.name,'button');
  choose.type='button';
  choose.hidden=true;
  choose.setAttribute('aria-pressed','false');
  card.append(header,phase,track,list,choose);
  lanes.append(card);
  return {card,phase,list,choose};
}

const seats=new Map(racers.map(([type,scout])=>[type,racerLane(type,scout)]));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function fetchRace(type,rows,raceId) {
  const hold=pause(SCOUTS[type].demoMs);
  let result;
  try {
    const response=await fetch('/api/hackersbay?action=parrot-race',{
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({scout:type,raceId}),
      signal:AbortSignal.timeout(20000)
    });
    if(response.ok) {
      const data=await response.json();
      if(Array.isArray(data.picks) && data.picks.length===3 && new Set(data.picks).size===3 &&
         data.picks.every(i=>Number.isInteger(i)&&i>=0&&i<rows.length) &&
         ['boat','demo'].includes(data.mode) && Number.isFinite(data.score)) result=data;
    }
  } catch { /* The local race uses the same scoring and pace. */ }
  await hold;
  if(result)return result;
  const picks=rankRaceCandidates(type,rows);
  return { mode:'demo',picks,...raceScore(rows,picks,SCOUTS[type].demoMs) };
}

function chooseCrew(type,picks,result) {
  const name=SCOUTS[type].name;
  const crew=picks.map(match=>match.person.id);
  try { localStorage.setItem(FEATHER_KEY,JSON.stringify({type,crew})); } catch { /* The crew link still works. */ }
  for(const [id,seat] of seats) {
    seat.choose.setAttribute('aria-pressed',String(id===type));
    seat.card.toggleAttribute('data-feather',id===type);
  }
  const medal=element('strong','◆ Golden Feather · '+name);
  const members=element('p','Your crew is '+new Intl.ListFormat('en').format(picks.map(match=>match.person.name))+'.');
  const board=element('a','Meet your winning crew →','button primary');
  board.href=EVENT_PATH+'?race='+crew.map(encodeURIComponent).join(',')+'&lens='+type+'#room';
  const actions=element('div',undefined,'organizer-actions');
  actions.append(board);
  winner.replaceChildren(medal,members,actions);
  winner.hidden=false;
  if(!result.receipt)return;
  const label=element('label','Public leaderboard name');
  const input=element('input');input.maxLength=48;
  input.value=getPersona()?.name || name;
  label.append(input);
  const post=element('button','Post feather to leaderboard','button');
  post.type='button';
  actions.append(label,post);
  post.addEventListener('click',async()=>{
    post.disabled=true;
    try {
      const response=await fetch('/api/hackersbay?action=race-feather',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ receipt:result.receipt,name:input.value }),signal:AbortSignal.timeout(8000)
      });
      if(!response.ok) throw new Error('Leaderboard unavailable');
      const link=element('a','View the leaderboard →','button');
      link.href='/hackersbay/race/leaderboard';
      post.replaceWith(link);
      label.remove();
    } catch {
      post.textContent='Post unavailable · try again';post.disabled=false;
    }
  });
}

form.addEventListener('submit',async event=>{
  event.preventDefault();
  start.disabled=true;
  winner.hidden=true;
  status.textContent='Four scouts launched.';
  log.replaceChildren();
  say('The scout teams share one brief. Each scores the room through its own class lens.');
  say('Demo log · Navigator reading github.com/example/harbor-tools via Context.dev.');
  for(const [id,{card,phase,list,choose}] of seats) {
    card.removeAttribute('data-feather');
    choose.textContent='Pick '+SCOUTS[id].name;
    card.dataset.state='running';phase.textContent='Racing…';
    list.replaceChildren();choose.hidden=true;choose.setAttribute('aria-pressed','false');
  }
  try{
    const people=await loadCrew();
    const prepared=racers.map(([type,scout])=>{
      const {rows,matches}=prepareScout(type,people);
      const confidence=Math.min(1,Math.max(...rows.map(row=>row[1]))/30);
      return {type,scout,matches,rows,color:scout.color,confidence,demoSeconds:scout.demoMs/1000};
    });
    stopScene?.();
    void startRaceScene(document.querySelector('#race-scene'),prepared,say).then(stop=>{ stopScene=stop; }).catch(()=>{});
    const raceId=crypto.randomUUID();
    let completed=0;
    const finished=await Promise.all(prepared.map(async({type,scout,matches,rows})=>{
      const result=await fetchRace(type,rows,raceId);
      const {card,phase,list,choose}=seats.get(type);
      card.dataset.state='done';
      phase.textContent=result.score+' points · '+(result.mode==='boat'?'Boat.dev VM':'demo score');
      phase.title='Match quality '+result.quality+' + speed '+result.speed;
      say(result.mode==='boat' ? scout.name+' · private Boat.dev sandbox booted and returned a ranking.' : scout.name+' · demo sandbox log, ranked three crew members.');
      const picks=result.picks.map(i=>matches.get(i));
      list.replaceChildren(...picks.map(match=>{
        const item=element('li'),body=element('div'),reason=describeMatch(match);
        body.append(element('strong',match.person.name),element('p',reason.yourReason),element('p',reason.theirReason));
        item.append(crewAvatar(match.person),body);
        return item;
      }));
      choose.hidden=false;
      choose.disabled=true;
      choose.onclick=()=>chooseCrew(type,picks,result);
      status.textContent=++completed+' of 4 scouts finished.';
      return {type,score:result.score};
    }));
    finished.sort((a,b)=>b.score-a.score);
    const leader=finished[0].type;
    status.textContent=SCOUTS[leader].name+' leads on match reasons and speed. Pick your winner.';
    for(const {choose} of seats.values()) choose.disabled=false;
    seats.get(leader).choose.textContent='Pick '+SCOUTS[leader].name+' · race leader';
  }catch{
    status.textContent='The Demo Day roster did not load. Try again.';
    for(const {card,phase} of seats.values()) { card.dataset.state='ready';phase.textContent='On deck'; }
  }finally{
    start.disabled=false;
  }
});

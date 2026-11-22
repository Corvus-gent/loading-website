import { element } from './event-data.js';
import { SCOUTS } from './race-model.js';

const table=document.querySelector('#leaderboard-rows');
const status=document.querySelector('#leaderboard-state');

async function refresh() {
  try {
    const response=await fetch('/api/hackersbay?action=race-board',{signal:AbortSignal.timeout(6000)});
    if(!response.ok) throw new Error('Leaderboard unavailable');
    const {leaders,mode}=await response.json();
    status.textContent=mode==='shared'
      ? (leaders.length?'Live scores from publicly posted feathers. Demo races are labeled.':'No feathers have been posted yet.')
      : 'Demo leaderboard · shared scores need Redis.';
    table.replaceChildren(...leaders.map((entry,i)=>{
      const row=element('tr');
      for(const text of [i+1,entry.name,SCOUTS[entry.type]?.name || 'Scout',entry.score,entry.mode==='boat'?'Boat.dev':'Demo']) row.append(element('td',String(text)));
      return row;
    }));
  } catch {
    status.textContent='The leaderboard is unavailable. It refreshes every 20 seconds.';
  }
}

void refresh();
setInterval(()=>{ if(!document.hidden) void refresh(); },20000);

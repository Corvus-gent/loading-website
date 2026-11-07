import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const href=value=>{const u=new URL(value,'https://corvus.gent');if(u.protocol!=='https:'||u.username||u.password)throw Error('Invalid squad link');return escape(value);};
export function renderMembers(team){
 return team.members.map(member=>`<li><a href="${href(member.url)}"${member.url.startsWith('/')||member.url==='https://corvus.gent'?'':' target="_blank" rel="noopener noreferrer"'}${member.id?` data-squad-member="${escape(member.id)}" data-hack-id="${escape(team.number)}"`:''} aria-label="${escape(member.name)}"><span class="squad-initial" aria-hidden="true">${escape(member.label.slice(0,1))}</span><span>${escape(member.label)}</span><span aria-hidden="true">↗</span></a></li>`).join('');
}
export function renderTeams(teams){
 if(!Array.isArray(teams))throw Error('Squads must be an array');
 const ids=new Set();
 return teams.slice().sort((a,b)=>b.date.localeCompare(a.date)||(b.number||0)-(a.number||0)).map(team=>{
  if(!/^[a-z0-9-]+$/.test(team.id)||ids.has(team.id)||!/^\d{4}-\d{2}$/.test(team.date)||!team.members?.length)throw Error('Invalid squad');ids.add(team.id);
  if(!Number.isInteger(team.teamSize)||team.teamSize<team.members.length)throw Error('Invalid team size');
  const date=new Intl.DateTimeFormat('en',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(team.date+'-01T12:00:00Z'));
  const missing=team.teamSize-team.members.length;
  return `<article class="squad-card" id="${escape(team.id)}"><div class="squad-meta"><span>0${escape(team.number||1)} / ${escape(team.location)}</span><time datetime="${team.date}">${date}</time></div><h2>${escape(team.name)}</h2><p class="squad-event">${escape(team.event)}, ${escape(team.location)}, ${date}</p><p class="squad-pitch">${escape(team.pitch||'')}</p><p class="squad-status"${team.start?` data-start="${escape(team.start)}"`:""}>${escape(team.status||'')}</p><p class="squad-size">${team.teamSize}-person team</p><ul class="squad-members" aria-label="Team members">${renderMembers(team)}${missing?`<li class="squad-pending">+${missing} teammates</li>`:''}</ul><div class="squad-actions"><a href="${href(team.build)}">see the build →</a>${team.repo?`<a href="${href(team.repo)}" target="_blank" rel="noopener noreferrer">github ↗</a>`:""}</div></article>`;
 }).join('\n');
}
export async function build(){
 const teams=JSON.parse(await fs.readFile('hackathons/teams.json','utf8'));
 const template=await fs.readFile('tools/templates/hackathons.html.tmpl','utf8');
 if(!template.includes('<!-- SQUAD_CARDS -->'))throw Error('Missing squad slot');
 await fs.writeFile('hackathons/index.html',template.replace('<!-- SQUAD_CARDS -->',renderTeams(teams)));
 const hack=await fs.readFile('hack/1/index.html','utf8');
 if(!hack.includes('<!-- SQUAD_START -->')||!hack.includes('<!-- SQUAD_END -->'))throw Error('Missing HackTheFeed squad slot');
 const team=teams.find(t=>t.number===1);
 const squad=`<section class="hack-squad" aria-labelledby="squad-title"><p class="eyebrow">built together</p><h2 id="squad-title">Squad</h2><ul class="squad-members" aria-label="HackTheFeed team">${renderMembers(team)}</ul><a class="hack-button" href="/hackathons/">see all squads →</a></section>`;
 await fs.writeFile('hack/1/index.html',hack.replace(/<!-- SQUAD_START -->[\s\S]*?<!-- SQUAD_END -->/,`<!-- SQUAD_START -->\n${squad}\n<!-- SQUAD_END -->`));
 console.log(`Built ${teams.length} hackathon squad card(s).`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await build();

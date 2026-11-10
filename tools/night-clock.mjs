// Session-only clock/logger. It never edits code, pushes, posts or starts AI calls.
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const clock=JSON.parse(await fs.readFile('/tmp/muse-run-clock.json','utf8'));
let next=clock.start+1800;
while(Date.now()/1000<clock.end){
 if(Date.now()/1000>=next){
  const time=execFileSync('date',['+%Y-%m-%d %H:%M:%S %Z'],{encoding:'utf8',env:{...process.env,TZ:'America/Los_Angeles'}}).trim();
  const work=JSON.parse(await fs.readFile('qa/current-work.json','utf8').catch(()=>'{}'));
  const commits=execFileSync('git',['log',`--since=@${next-1800}`,'--format=%h %s'],{encoding:'utf8'}).trim().replaceAll('\n','; ')||'No new commit in this interval; work in progress';
  const line=`\n- **${time} — 30-minute checkpoint:** Done: ${work.done||'Baseline in progress'}. Current/next: ${work.next||'Continue route QA'}. Commits: ${commits}.\n`;
  await fs.appendFile('NIGHT_LOG.md',line);console.log(time+' checkpoint recorded');next+=1800;
 }
 await new Promise(r=>setTimeout(r,15000));
}
const end=execFileSync('date',['+%Y-%m-%d %H:%M:%S %Z'],{encoding:'utf8',env:{...process.env,TZ:'America/Los_Angeles'}}).trim();
await fs.appendFile('NIGHT_LOG.md',`\n- **${end} — Four-hour clock reached.** Final verification and handoff may now proceed.\n`);console.log(end+' END reached');

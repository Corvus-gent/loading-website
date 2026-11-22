// One bounded snapshot read per realm visit. Missing counts remain unknown.
const root=document.querySelector('.arena-stats');
if(root){
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels'}).format(new Date());
 fetch('/api/stats?'+new URLSearchParams({page:'overview',day}),{credentials:'omit',signal:AbortSignal.timeout(8000)})
 .then(r=>{if(!r.ok)throw Error();return r.json();}).then(snapshot=>{
  const d=snapshot.data;if(!d)throw Error();
  const valid=n=>Number.isSafeInteger(n)&&n>=0;
  if (valid(d.visitors)) {
    const count = (d.visitors + (valid(d.unseen?.day) ? d.unseen.day : 0)).toLocaleString();
    root.querySelector('[data-home-visitors]').textContent = count;
    const act = document.querySelector('[data-stats-act]');
    if (act) {
      act.textContent = count + ' visitors · measured day';
      act.hidden = false;
    }
  }
  if(valid(d.soldiers?.all))root.querySelector('[data-home-soldiers]').textContent=d.soldiers.all.toLocaleString();
  root.querySelector('[data-home-stats-note]').textContent=`Measured day: ${snapshot.day||day}${snapshot.stale||snapshot.state==='partial'?' · saved / partial snapshot':''}. Open the dashboard for context.`;
 }).catch(()=>{root.querySelector('[data-home-stats-note]').textContent='Counts are unavailable here. Explore the other statistics below.';});
}

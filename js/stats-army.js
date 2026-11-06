const root=document.getElementById('section-output');
const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
window.statsPage.watch('army',window.statsPage.today,s=>{
 if(!s.data){root.textContent=s.state==='warming'?'counting the arrivals…':'the count is resting. try again shortly.';return;}
 const d=s.data,n=d.visitors==null?'—':d.visitors+(d.unseen?.day||0);
 root.replaceChildren(el('h2',n+' visitors today'),el('p',`soldiers who said ok: ${d.soldiers?.day??0} today · ${d.soldiers?.all??0} all time`),el('p',`unseen visitors: ${d.unseen?.day??0}`),el('p','unseen visitors are anonymous page hits, not unique people. the total combines those hits with PostHog daily visitor estimates. soldiers are browser/site acknowledgements, not verified people.'));
});

// Capture only approved campaign categories before analytics cleans the address bar.
(() => {
 const p=new URLSearchParams(location.search);
 const props={utm_campaign:'hack'};
 if(p.has('utm_source'))props.utm_source=p.get('utm_source');
 if(p.has('utm_medium'))props.utm_medium=p.get('utm_medium');
 if(p.get('utm_content')==='squads'){props.utm_content='squads';props.short_slug='squads';}
 window.__phProps={...window.__phProps,...props};
})();

function updateSquadStatus(){for(const node of document.querySelectorAll('[data-start]'))if(Date.now()>=Date.parse(node.dataset.start))node.textContent='Building solo. Follow the run.';}
updateSquadStatus();setInterval(()=>{if(!document.hidden)updateSquadStatus();},30000);

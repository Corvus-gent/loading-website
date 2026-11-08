import {readPreference,savePreference} from './storage.js';
// Pidgy easter eggs: hidden feathers on every page + a peeking Pidgy here and there.
const TOTAL = 7;
const LINES = ["coo.", "a Pidgy feather.", "Pidgy was here.", "inbox zero tastes like this.", "the flock sees you.", "follow the feathers.", "almost there."];
let memory=[];
const found = () => { const value=readPreference('feathers',memory);return [...new Set([...memory,...(Array.isArray(value)?value:[])])].filter(id=>Object.hasOwn(SPOTS,id)); };
const save = arr => { memory=[...new Set(arr)];savePreference('feathers',memory); };
let identity=null,serverSpots=new Set(),syncing=false;
// Read-only: a visitor without an army identity stays local-only.
const identityReady=fetch('/api/army',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(8000)})
 .then(r=>r.ok?r.json():null).then(data=>{mergeSelf(data?.self);return identity;}).catch(()=>null);
function mergeSelf(self){
 identity=self;if(!self)return;
 const spots=self.featherSpots||(Array.isArray(self.feathers)?self.feathers:[]);
 serverSpots=new Set(spots.filter(id=>Object.hasOwn(SPOTS,id)));
 save([...found(),...serverSpots]);renderFeather();
}
async function syncFound(){
 await identityReady;if(!identity||syncing)return;syncing=true;
 try{
  // Loaded only for an existing identity. submit() obtains the action-bound
  // challenge and solves it in the same worker used by enlistment.
  const {submit}=await import('./army/client.js?v=20261108-entry1');
  for(let i=0;i<TOTAL;i++){
   const spot=found().find(id=>!serverSpots.has(id));if(!spot)break;
   const result=await submit('feather',{spot});mergeSelf(result.self);
  }
 }catch{/* Local catches survive outages and retry on the next page load. */}
 finally{syncing=false;}
}
identityReady.then(()=>syncFound());

function toast(html) {
  let t = document.getElementById("egg-toast");
  if (!t) { t = document.createElement("div"); t.id = "egg-toast"; t.className = "egg-toast"; document.body.appendChild(t); }
  t.innerHTML = html; t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 3500);
}

function collect(id) {
  const got = found();
  if(got.includes(id)){toast(`🪶 already caught · ${got.length}/${TOTAL}`);return;}
  got.push(id);save(got);renderFeather();
  const n = got.length;
  toast(n >= TOTAL
    ? `🪶 ${n}/${TOTAL}. you found the whole flock. <a href="/links/gabe">claim your free Pidgy trial →</a>`
    : `🪶 ${LINES[(n - 1) % LINES.length]} ${n}/${TOTAL} feathers found.`);
  syncFound();
  try{window.posthog?.capture("feather_found",{id,total:n});}catch{}
}
export function collectRealmFeather() {
  // An alternate hiding place for one of the original seven.
  let id = readPreference('realm-feather');
  if (!Object.hasOwn(SPOTS,id)) {
    id = Object.keys(SPOTS).find(key => !found().includes(key)) || '/';
    savePreference('realm-feather',id);
  }
  collect(id);
}
function renderFeather() {
  if(!spot)return;
  const caught=found().includes(page),f=document.getElementById('hidden-feather')||document.createElement('button');
  f.id='hidden-feather';f.type='button';f.className=caught?'feather-caught':'feather';
  f.setAttribute('aria-label',caught?`already caught · ${found().length}/${TOTAL}`:'catch the feather');
  f.replaceChildren();
  if(caught)f.textContent='caught';
  else{const img=document.createElement('img');img.src='/img/feather.png';img.alt='';f.append(img);}
  Object.assign(f.style,spot);
  f.onclick=e=>{e.stopPropagation();collect(page);};
  if(!f.isConnected)document.body.appendChild(f);
}

// one feather per page. kept clear of the privacy notice and the header so it can actually be tapped
const SPOTS = {
  "/": { top: "45%", left: "6px", transform: "rotate(-20deg)" },
  "/now/": { top: "40%", right: "6px", transform: "rotate(40deg)" },
  "/sidequests/": { top: "62%", right: "14px" },
  "/support/": { top: "120px", left: "8px", transform: "rotate(-30deg)" },
  "/support/books/": { top: "30%", right: "10px", transform: "rotate(15deg)" },
  "/languages/": { top: "55%", left: "10px", transform: "rotate(160deg)" },
  "/call/": { top: "35%", left: "10px", transform: "rotate(90deg)" },
};
const page = location.pathname.replace(/\/?$/, "/");
const spot = SPOTS[page];
renderFeather();

// the sticky-note Pidgy peeks on /now
if (location.pathname === "/now/") {
  const p = document.createElement("img");
  p.src = "/img/sticky-pidgy.png"; p.alt = ""; p.className = "peek";
  p.addEventListener("click", () => toast("Pidgy remembers what you forget. <a href=\"https://pidgy-ai.com\" target=\"_blank\" rel=\"noreferrer\">pidgy-ai.com</a>"));
  document.body.appendChild(p);
}

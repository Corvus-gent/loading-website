const owner = 'gabriel@corvus.gent';
const $ = id => document.getElementById(id);
let draft, revision, dirty = false;
const day = () => draft.days[$('day').selectedIndex];
const tell = message => { $('status').textContent = message; };

async function request(path, method = 'GET', body) {
  const response = await fetch(path, {method, cache:'no-store', credentials:'same-origin',
    ...(body && {headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)})});
  if (!response.ok) throw Object.assign(new Error('Request failed'), {status:response.status});
  return response.json();
}
const auth = (action, code) => request('/api/week-auth', 'POST', {action, email:owner, code});
function showEditor(visible) {
  $('login').hidden = visible;
  $('editor').hidden = !visible;
}
function markDirty() {
  dirty = true;
  tell('Ongepubliceerde wijzigingen.');
}
function renderDay() {
  const data = day();
  $('route').value = data.route;
  $('note').value = data.note;
  $('events').replaceChildren(...data.events.map((event, index) => {
    const row = document.createElement('div');
    row.className = 'event';
    const time = document.createElement('input');
    time.type = 'time'; time.required = true; time.value = event.time;
    time.setAttribute('aria-label', 'Tijdstip ' + (index + 1));
    time.oninput = () => { event.time = time.value; markDirty(); };
    const activity = document.createElement('input');
    activity.required = true; activity.maxLength = 240; activity.value = event.text;
    activity.placeholder = 'Activiteit'; activity.setAttribute('aria-label', 'Activiteit ' + (index + 1));
    activity.oninput = () => { event.text = activity.value; markDirty(); };
    const remove = document.createElement('button');
    remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Verwijder tijdstip ' + (index + 1));
    remove.onclick = () => { data.events.splice(index, 1); markDirty(); renderDay(); };
    row.append(time, activity, remove); return row;
  }));
  $('add').disabled = data.events.length >= 48;
}
function apply(data) {
  revision = data.revision; draft = data.itinerary; dirty = false;
  $('title').value = draft.title; $('intro').value = draft.intro;
  $('reload').hidden = true; renderDay();
}
async function openEditor() {
  if (!draft) apply(await request('/api/week'));
  showEditor(true);
  tell(dirty ? 'Je wijzigingen staan klaar om te publiceren.' : '');
}
$('send').onclick = async () => {
  $('send').disabled = true;
  try { await auth('request'); tell('Code verstuurd. Vul de zes cijfers binnen drie minuten in.'); $('code').focus(); }
  catch (err) { tell(err.status === 429 ? 'Te veel aanvragen. Probeer het over 15 minuten opnieuw.' : 'Versturen mislukt. Probeer opnieuw.'); }
  finally { $('send').disabled = false; }
};
$('verify').onsubmit = async e => {
  e.preventDefault();
  const button = e.submitter || $('verify').querySelector('button'); button.disabled = true;
  try { await auth('verify', $('code').value); $('code').value = ''; await openEditor(); }
  catch (err) { tell([400,429].includes(err.status) ? 'De code is ongeldig of verlopen. Vraag een nieuwe aan.' : 'Inloggen of laden mislukt. Probeer opnieuw.'); }
  finally { button.disabled = false; }
};
$('day').onchange = renderDay;
for (const key of ['title','intro','route','note']) {
  $(key).oninput = () => { (['route','note'].includes(key) ? day() : draft)[key] = $(key).value; markDirty(); };
}
$('add').onclick = () => {
  const events = day().events;
  const last = events.at(-1)?.time;
  const time = last ? String(Math.min(Number(last.slice(0, 2)) + 1, 23)).padStart(2,'0') + ':00' : '07:00';
  events.push({time, text:''}); markDirty(); renderDay();
  $('events').lastElementChild.querySelectorAll('input')[1].focus();
};
$('editor').onsubmit = async e => {
  e.preventDefault();
  const invalid = draft.days.findIndex(d => d.events.some(ev => !ev.time || !ev.text.trim()));
  if (invalid >= 0) {
    $('day').selectedIndex = invalid; renderDay(); tell('Vul een tijd en activiteit in voor elk tijdstip.'); $('editor').reportValidity(); return;
  }
  $('fields').disabled = true;
  try { apply(await request('/api/week','PUT',{revision, itinerary:draft})); tell('Gepubliceerd. Je wijzigingen staan op de publieke week.'); }
  catch (err) {
    if (err.status === 401 || err.status === 403) { showEditor(false); tell('Log opnieuw in. Je wijzigingen blijven hier bewaard.'); }
    else if (err.status === 409) { $('reload').hidden = false; tell('Er is elders een wijziging gepubliceerd. Kopieer je eigen wijzigingen voordat je de gepubliceerde versie herlaadt.'); }
    else tell('Publiceren mislukt. Je wijzigingen staan nog in deze tab.');
  } finally { $('fields').disabled = false; }
};
$('reload').onclick = async () => {
  try { apply(await request('/api/week')); tell('Gepubliceerde versie geladen.'); } catch { tell('Laden mislukt. Probeer opnieuw.'); }
};
$('logout').onclick = async () => {
  try { await auth('logout'); showEditor(false); $('reload').hidden = true; tell(dirty ? 'Uitgelogd. Je concept blijft in deze tab.' : 'Uitgelogd.'); if (!dirty) draft = null; }
  catch { tell('Uitloggen mislukt. Probeer opnieuw.'); }
};
try { if ((await request('/api/week-auth')).email === owner) await openEditor(); }
catch { tell('Verbinding mislukt. Herlaad de pagina om opnieuw te proberen.'); }

import { forms } from '/forms/generated.js';
import { createFormDraft } from './forms-draft.js';
const $ = id => document.getElementById(id);
const slug = location.pathname.split('/').filter(Boolean)[1];
const form = Object.hasOwn(forms, slug || '') ? forms[slug] : null;
if (!form) {
  document.title = 'Form not found · Corvus'; $('h1').textContent = 'Form not found'; $('status').textContent = 'Check the link and try again.'; $('doneBar').hidden = true; $('who').hidden = true; document.querySelector('.auto-note').hidden = true;
} else {
  document.title = form.title; $('h1').textContent = form.title; $('sub').textContent = form.subtitle || '';
  // This HTML is authored in the repository's form config, never from responses.
  $('who').innerHTML = form.introHtml;
  let answers = {}, controller;
  const views = new Map();
  function progress() {
    const n = form.questions.filter(q => { const a = answers[q.id] || {}; return a.vote || (a.comment || a.text || '').trim(); }).length;
    const message = `${n} / ${form.questions.length} answered`;
    $('progT').textContent = message + (form.minutes ? ` · ~${form.minutes} min` : '');
    $('bottomProgress').textContent = message;
    for (const id of ['progF', 'bottomFill']) $(id).style.width = `${100 * n / form.questions.length}%`;
    $('doneTxt').textContent = n === form.questions.length ? 'All done — thank you! 🙌' : `${form.questions.length - n} left`;
    for (const section of form.sections) {
      const questions = form.questions.filter(q => q.section === section.id);
      const answered = questions.filter(q => { const a = answers[q.id] || {}; return a.vote || (a.comment || a.text || '').trim(); }).length;
      document.getElementById('count-' + section.id).textContent = `${answered}/${questions.length}`;
    }
  }
  const element = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text) el.textContent = text; return el; };
  function updateCard(q) {
    const view = views.get(q.id), a = answers[q.id] || {};
    view.card.classList.toggle('up', a.vote === 'up'); view.card.classList.toggle('down', a.vote === 'down');
    for (const vote of ['up', 'down']) if (view[vote]) { const selected = a.vote === vote; view[vote].classList.toggle('on', selected); view[vote].setAttribute('aria-pressed', String(selected)); view[vote].querySelector('.n').textContent = selected ? '1' : '0'; }
  }
  function changed(q, patch) {
    answers[q.id] = { ...(answers[q.id] || {}), ...patch };
    controller.change(answers); updateCard(q); progress();
    $('doneBtn').textContent = 'Done ✓';
  }
  function comment(q, view) {
    view.commentButton?.remove();
    const a = answers[q.id] || {}, field = q.type === 'thumbs' ? 'comment' : 'text';
    const area = element('textarea'); area.rows = q.type === 'text' ? 2 : 1;
    area.placeholder = q.placeholder || 'Your answer…'; area.maxLength = 4000; area.value = a[field] || '';
    area.setAttribute('aria-label', q.type === 'text' ? q.label : 'Optional comment: ' + q.label);
    area.setAttribute('aria-describedby', 'question-' + q.id);
    const autosize = () => { area.style.height = 'auto'; area.style.height = Math.max(q.type === 'text' ? 65 : 38, area.scrollHeight + 2) + 'px'; };
    area.addEventListener('input', () => { autosize(); changed(q, { [field]: area.value }); });
    view.card.append(area); requestAnimationFrame(autosize); view.area = area;
    return area;
  }
  function render() {
    $('list').replaceChildren();
    for (const section of form.sections) {
      const sec = element('section'), heading = element('h2');
      heading.append(element('span', '', section.title)); const count = element('span'); count.id = 'count-' + section.id; heading.append(count); sec.append(heading);
      for (const q of form.questions.filter(q => q.section === section.id)) {
        const card = element('div', 'card'), row = element('div', 'row'), txt = element('div', 'txt'), title = element('div', 'ttl', q.label);
        card.dataset.id = q.id; title.id = 'question-' + q.id; txt.append(title); row.append(txt); card.append(row);
        const view = { card }; views.set(q.id, view);
        if (q.type === 'thumbs') {
          const votes = element('div', 'votes');
          for (const vote of ['up', 'down']) {
            const button = element('button', 'v ' + vote, vote === 'up' ? '👍' : '👎'); button.type = 'button'; button.setAttribute('aria-label', `${vote === 'up' ? 'Thumbs up' : 'Thumbs down'}: ${q.label}`); button.append(element('span', 'n', '0'));
            button.onclick = () => changed(q, { vote: answers[q.id]?.vote === vote ? null : vote });
            view[vote] = button; votes.append(button);
          }
          row.append(votes);
        }
        if (q.type === 'text' || answers[q.id]?.comment) comment(q, view);
        else {
          const button = element('button', 'cbtn', '💬 add a comment'); button.type = 'button'; view.commentButton = button;
          button.onclick = () => comment(q, view).focus(); card.append(button);
        }
        updateCard(q); sec.append(card);
      }
      $('list').append(sec);
    }
    progress();
  }
  controller = createFormDraft({ slug, allowedIds: form.questions.map(q => q.id), onRestore(value) { answers = Object.fromEntries(Object.entries(value).filter(([id]) => form.questions.some(q => q.id === id))); render(); }, onStatus(message) { $('status').textContent = message; } });
  $('feedback').addEventListener('submit', async event => {
    event.preventDefault();
    const controls = [...document.querySelectorAll('button,textarea')]; controls.forEach(el => el.disabled = true); $('doneBtn').textContent = 'Sending…';
    try { const result = await controller.done(); $('doneBtn').textContent = result.pending ? 'Still sending…' : 'Thanks, sent!'; }
    catch { $('status').textContent = 'Your answers are saved on this device. Could not send yet — please try Done again.'; $('doneBtn').textContent = 'Try again ✓'; }
    finally { controls.forEach(el => el.disabled = false); }
  });
}

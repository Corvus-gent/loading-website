import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { permalink } from './catalog.js';
import { availableChoices, calendarFile, nextBedtime, questions, recommendation, resultCode, resultTitle, timeline } from './ritual.js';
import { Pause, Sound, useAtmosphere } from './atmosphere.jsx';
import { FaceCamera } from './face-camera.jsx';
import { createFaceDetector } from './face-detector.js';
import { Scan } from './scan.jsx';

const { products, currency, mode, initialResult } = JSON.parse(document.querySelector('#ray-data').textContent);
const choices = availableChoices(products);
const options = new Map(choices.map(choice => [String(choice.id), choice]));
const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency });
const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const bagKey = 'raygifts-bag';

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function save(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}
function readBag() {
  try {
    const bag = JSON.parse(read(bagKey));
    return Object.fromEntries(Object.entries(bag).filter(([id, qty]) => /^\d+$/.test(id) && Number.isSafeInteger(qty) && qty > 0 && qty <= 99));
  } catch { return {}; }
}

function Bedtime({ add }) {
  const [time, setTime] = useState(() => read('raygifts-bedtime') || '');
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const target = nextBedtime(time, now);
  const events = target ? timeline(target, products) : [];
  const items = events.flatMap(event => event.choice ? [event.choice] : []);
  const remaining = target ? Math.ceil((target - now) / 60000) : 0;
  const hours = Math.floor(remaining / 60);
  const minutes = remaining % 60;
  function download() {
    const calendar = calendarFile(events, now);
    const href = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = href;
    link.download = 'ray-wind-down.ics';
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
  return <>
    <div className="inline"><label>Bedtime <input type="time" value={time} onChange={event => {
      setTime(event.target.value);
      save('raygifts-bedtime', event.target.value);
    }} /></label><time className="tag" dateTime={now.toISOString()}>{clock.format(now)}</time></div>
    {target && <>
      <p className="tag">{hours ? `${hours}h ` : ''}{minutes}m until your bedtime</p>
      <ol className="timeline">{events.map(event => <li key={event.name}>
        <time className="tag" dateTime={event.time.toISOString()}>{clock.format(event.time)}</time>
        <div><h3>{event.name}</h3><p>{event.copy}</p>
        {event.choice && <a className="chip" href={'/raygifts/' + event.choice.product.handle}>{event.choice.product.name}</a>}</div>
      </li>)}</ol>
      <div className="inline">
        {items.length > 0 && <button type="button" onClick={() => add(items, 'Routine added to bag.')}>Add whole routine</button>}
        <button type="button" onClick={download}>Download calendar</button>
      </div>
    </>}
  </>;
}

function Quiz({ add }) {
  const [code, setCode] = useState(resultCode(initialResult));
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [copied, setCopied] = useState(false);
  const heading = useRef(null);
  const moved = useRef(false);
  const items = recommendation(products, code);
  useEffect(() => {
    if (moved.current) heading.current?.focus();
    moved.current = true;
  }, [step, code]);
  useEffect(() => {
    function fromHistory() {
      setCode(resultCode(new URL(location.href).searchParams.get('r')));
      setStep(0);
      setAnswers([]);
      setCopied(false);
    }
    window.addEventListener('popstate', fromHistory);
    return () => window.removeEventListener('popstate', fromHistory);
  }, []);
  function navigate(value) {
    const url = new URL(location.href);
    if (value) url.searchParams.set('r', value);
    else url.searchParams.delete('r');
    history.pushState(null, '', url);
    setCode(value);
    setCopied(false);
  }
  if (code) return <>
    <h2 ref={heading} tabIndex={-1}>{resultTitle(code)}</h2>
    <p>{code[2] === '1' ? 'A quiet hour to give away.' : 'A quiet hour to make your own.'}</p>
    {items.length > 0 ? <>
      <ul className="plain">{items.map(item => <li key={item.id}><a href={'/raygifts/' + item.product.handle}>{item.label}</a> <span className="tag">{money.format(item.price)}</span></li>)}</ul>
      <button onClick={() => add(items, 'Ritual added to bag.')}>Add this bundle</button>
    </> : <p>The shelf is empty tonight.</p>}
    <div className="inline share">
      <button onClick={async () => {
        try { await navigator.clipboard.writeText(location.href); setCopied(true); }
        catch { document.querySelector('#result-link')?.select(); }
      }}>{copied ? 'Link copied' : 'Copy result link'}</button>
      <button onClick={() => { setAnswers([]); setStep(0); navigate(''); }}>Start over</button>
    </div>
    <label className="share-link">Shareable result URL<input id="result-link" readOnly value={location.href} onFocus={event => event.target.select()} /></label>
  </>;
  const question = questions[step];
  return <>
    <p className="tag">{step + 1} / {questions.length}</p>
    <h2 ref={heading} tabIndex={-1}>{question.label}</h2>
    <div className="quiz-options">{question.options.map((option, index) => <button key={option} onClick={() => {
      const next = [...answers.slice(0, step), index];
      setAnswers(next);
      if (next.length === questions.length) navigate(next.join(''));
      else setStep(step + 1);
    }}>{option}</button>)}</div>
    {step > 0 && <button className="back" onClick={() => setStep(step - 1)}>Previous question</button>}
  </>;
}

function Box({ add }) {
  const [selected, setSelected] = useState([]);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const items = selected.map(id => options.get(id));
  function insert(id) {
    if (!options.has(id)) return;
    if (selected.length === 3) { setMessage('Remove an item to make room.'); return; }
    setSelected([...selected, id]);
    setMessage('');
  }
  const complete = items.length === 3;
  return <>
    <div className="gift-box" data-complete={complete} onDragOver={event => event.preventDefault()} onDrop={event => {
      event.preventDefault();
      insert(event.dataTransfer.getData('text/plain'));
    }}>
      <ol aria-label="Gift box slots">{[0, 1, 2].map(index => {
        const item = items[index];
        const photo = item?.product.images[0];
        const image = photo && new URL(photo.src);
        image?.searchParams.set('width', '160');
        return <li key={index}>{item ? <>
          {image && <img src={photo.hosted?.card || image.href} alt={item.product.name} width="80" height="80" loading="lazy" />}
          <span>{item.label}</span>
          <button onClick={() => { setSelected(selected.filter((_, slot) => slot !== index)); setMessage(''); }} aria-label={'Remove ' + item.label}>Remove</button>
        </> : <span>Empty slot</span>}</li>;
      })}</ol>
      <div className="ribbon" aria-hidden="true"></div>
    </div>
    <p className="tag" aria-live="polite">{items.length}/3 items · {money.format(items.reduce((sum, {price}) => sum + price, 0))}</p>
    <div className="box-picks">{choices.map(item => <button key={item.id} draggable onDragStart={event => event.dataTransfer.setData('text/plain', String(item.id))} onClick={() => insert(String(item.id))}>
      {item.label} <span className="tag">{money.format(item.price)}</span>
    </button>)}</div>
    {choices.length > 0 ? <>
      <p role="status">{message}</p>
      <label className="note">Gift note<textarea value={note} onChange={event => setNote(event.target.value)} maxLength={200} rows={3} /></label>
      <button disabled={!complete} onClick={() => add(items, 'Gift box added to bag.', note)}>Add gift box to bag</button>
    </> : <p>The shelf is empty tonight.</p>}
  </>;
}

function App() {
  const [bag, setBag] = useState(readBag);
  const [note, setNote] = useState(() => read('raygifts-note') || '');
  const [status, setStatus] = useState('');
  const [lastAdded, setLastAdded] = useState(null);
  const feature = document.querySelector('#ray-feature');
  const lines = Object.entries(bag).filter(([id]) => options.has(id)).map(([id, qty]) => ({ id, qty }));
  const count = lines.reduce((sum, {qty}) => sum + qty, 0);

  useAtmosphere();
  useEffect(() => {
    save(bagKey, JSON.stringify(bag));
    save('raygifts-note', note);
    document.querySelector('#bag-count').textContent = count;
  }, [bag, count, note]);

  function add(items, message, giftNote) {
    setBag(previous => {
      const next = { ...previous };
      for (const { id } of items) next[id] = Math.min(99, (next[id] || 0) + 1);
      return next;
    });
    if (giftNote !== undefined) setNote(giftNote);
    setStatus(message);
    setLastAdded({ message, time: Date.now() });
  }
  useEffect(() => {
    function submit(event) {
      const form = event.target;
      if (!form.matches('[data-add]')) return;
      event.preventDefault();
      const item = options.get(new FormData(form).get('variant'));
      if (!item) return;
      add([item], item.product.name + ' added to bag.');
      const button = form.querySelector('button');
      button.textContent = 'Added to bag';
      clearTimeout(button.rayFeedback);
      button.rayFeedback = setTimeout(() => { button.textContent = 'Add to bag'; }, 1300);
    }
    document.addEventListener('submit', submit);
    return () => document.removeEventListener('submit', submit);
  }, []);

  function remove(id) {
    setBag(previous => {
      const next = { ...previous };
      if (next[id] <= 1) delete next[id];
      else next[id]--;
      return next;
    });
    if (count === 1) {
      setNote('');
      document.querySelector('#bag h2').focus();
    }
    setStatus('Removed one ' + options.get(id).label + '.');
  }

  useEffect(() => {
    if (!lastAdded) return;
    const timer = setTimeout(() => setLastAdded(null), 4500);
    return () => clearTimeout(timer);
  }, [lastAdded]);

  return <>
    {feature && createPortal(
      mode === 'scan' ? <Scan products={products} currency={currency} /> : mode === 'quiz' ? <Quiz add={add} /> : mode === 'box' ? <Box add={add} /> : <Bedtime add={add} />,
      feature
    )}
    {document.querySelector('#ray-pause') && createPortal(
      <><Pause />{createFaceDetector && <FaceCamera createDetector={createFaceDetector} />}</>,
      document.querySelector('#ray-pause')
    )}
    {document.querySelector('#ray-sound') && createPortal(<Sound />, document.querySelector('#ray-sound'))}
    <div className="cart" aria-label="Bag contents">
      {count ? <>
        <ul className="plain">{lines.map(({ id, qty }) => {
          const item = options.get(id);
          return <li key={id}><span>{qty} × {item.label} · {money.format(item.price * qty)}</span>
            <button onClick={() => remove(id)} aria-label={'Remove one ' + item.label}>Remove one</button></li>;
        })}</ul>
        <p className="tag">Subtotal {money.format(lines.reduce((total, {id, qty}) => total + options.get(id).price * qty, 0))}</p>
        {note && <p>Gift note: {note} <button onClick={() => setNote('')}>Clear gift note</button></p>}
        <a className="action lit" href={permalink(lines, { note })}>Go to checkout</a>
      </> : <p>Your bag is empty.</p>}
    </div>
    <output id="cart-status" className="visually-hidden" aria-live="polite">{status}</output>
    {lastAdded && <a className="cart-notice" href="#bag" key={lastAdded.time} onClick={() => setLastAdded(null)}>{lastAdded.message} View bag</a>}
  </>;
}

createRoot(document.querySelector('#ray-app')).render(<App />);

import { useEffect, useRef, useState } from 'react';
import { store } from './catalog.js';
import { cameraError, grabFrame, openCamera, stopCamera } from './pipeline/camera.ts';
import { analyze } from './pipeline/score.ts';

const SECONDS = 20;
const hints = [
  [0, 'Face the light and hold the phone at eye level.'],
  [4, 'Relax your jaw. Breathe slowly.'],
  [9, 'Keep still — tiny movements are fine.'],
  [14, 'Nearly there. Soft eyes.'],
  [18, 'Hold it…'],
];
const cameraCopy = {
  denied: 'Camera access was blocked. Allow it in your browser settings, or use a photo instead.',
  missing: 'We couldn’t find a camera on this device. You can use a photo instead.',
  busy: 'Your camera is busy in another app. Close it and try again, or use a photo.',
  unsupported: 'This browser can’t open the camera here. You can use a photo instead.',
  unknown: 'The camera didn’t start. Try again, or use a photo instead.',
};
const picks = [
  [/eye pillow.*slumber|slumber/i, 'For heavy eyes after a long screen day.'],
  [/mist.*lavender|lavender.*mist/i, 'Two sprays on the pillow, lights down.'],
  [/good sleep kit/i, 'The whole wind-down in one box.'],
];

function recommendations(products) {
  return picks.map(([pattern, why]) => {
    const product = products.find(item => pattern.test(item.name))
      || (pattern.source.includes('pillow') ? products.find(item => /eye pillow/i.test(item.name))
        : pattern.source.includes('mist') ? products.find(item => /mist/i.test(item.name)) : undefined);
    const variant = product?.variants.find(item => item.available);
    return product && variant ? { product, variant, why } : null;
  }).filter(Boolean);
}

export function Scan({ products, currency }) {
  const [step, setStep] = useState('consent');
  const [source, setSource] = useState('camera');
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [photo, setPhoto] = useState('');
  const video = useRef(null);
  const image = useRef(null);
  const stream = useRef(null);
  const frames = useRef([]);

  useEffect(() => () => stopCamera(stream.current), []);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo); }, [photo]);

  async function startCamera() {
    setError('');
    try {
      const media = await openCamera();
      stream.current = media;
      setSource('camera');
      setStep('scanning');
      requestAnimationFrame(() => {
        if (video.current) {
          video.current.srcObject = media;
          video.current.play().catch(() => {});
        }
      });
    } catch (failure) {
      const kind = failure?.name === 'Unsupported' ? 'unsupported' : cameraError(failure);
      setError(cameraCopy[kind]);
    }
  }

  function pickPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    stopCamera(stream.current);
    stream.current = null;
    setError('');
    setPhoto(URL.createObjectURL(file));
    setSource('photo');
    setStep('scanning');
  }

  useEffect(() => {
    if (step !== 'scanning') return;
    frames.current = [];
    const started = performance.now();
    let last = 0;
    let raf;
    const tick = now => {
      const t = now - started;
      setElapsed(Math.min(SECONDS, t / 1000));
      if (t - last > 250) {
        last = t;
        const el = source === 'camera' ? video.current : image.current;
        const frame = el && (source === 'camera' || frames.current.length === 0) ? grabFrame(el, t, source) : null;
        if (frame) frames.current.push(frame);
        if (frames.current.length > 90) frames.current.shift();
      }
      if (t >= SECONDS * 1000) {
        stopCamera(stream.current);
        stream.current = null;
        analyze(frames.current).finally(() => { frames.current = []; setStep('results'); });
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step, source]);

  function cancel() {
    stopCamera(stream.current);
    stream.current = null;
    setStep('consent');
    setElapsed(0);
  }

  const photoInput = <label className="action scan-photo">Use a photo instead
    <input type="file" accept="image/*" capture="user" onChange={pickPhoto} className="visually-hidden" /></label>;

  if (step === 'consent') return <div className="scan-card">
    <ul className="scan-promises">
      <li><strong>On-device.</strong> Your camera feed is processed in this browser tab.</li>
      <li><strong>Nothing uploaded.</strong> No video, photo or result leaves your phone.</li>
      <li><strong>Wellness fun.</strong> This is not medical advice and not a diagnosis.</li>
    </ul>
    <div className="inline"><button className="action lit" type="button" onClick={startCamera}>Start the 20-second scan</button>{photoInput}</div>
    {error && <p className="scan-error" role="alert">{error}</p>}
  </div>;

  if (step === 'scanning') {
    const progress = elapsed / SECONDS;
    const hint = [...hints].reverse().find(([at]) => elapsed >= at)[1];
    const r = 46, c = 2 * Math.PI * r;
    return <div className="scan-card">
      {source === 'photo' && <p className="scan-warning" role="status">A photo is less accurate than a live scan.</p>}
      <div className="scan-stage">
        {source === 'camera'
          ? <video ref={video} playsInline muted autoPlay aria-label="Your camera preview" />
          : <img ref={image} src={photo} alt="Your photo" />}
        <svg className="scan-ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r={r} />
          <circle cx="50" cy="50" r={r} className="scan-ring-fill" strokeDasharray={c} strokeDashoffset={c * (1 - progress)} />
        </svg>
        <p className="scan-hint" aria-live="polite">{hint}</p>
      </div>
      <div className="inline"><span className="tag" role="progressbar" aria-valuemin="0" aria-valuemax={SECONDS} aria-valuenow={Math.round(elapsed)}>{Math.ceil(SECONDS - elapsed)}s left</span>
        <button type="button" onClick={cancel}>Cancel</button></div>
    </div>;
  }

  const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency });
  const recs = recommendations(products);
  return <div className="scan-card">
    <p className="eyebrow scan-badge">Preview: AI analysis coming soon</p>
    <h2>Thanks for sitting still.</h2>
    <p>We haven’t switched on the analysis yet, so there’s no score to show — we won’t make one up. When it lands, it will run entirely on this device.</p>
    <h3>For your quiet hour tonight</h3>
    {recs.length ? <ul className="plain scan-recs">{recs.map(({ product, variant, why }) => <li key={variant.id}>
      <strong>{product.name}</strong><span>{why}</span>
      <a className="action lit" href={`${store}/cart/${variant.id}:1`}>Add to cart · {money.format(variant.price)}</a></li>)}</ul>
      : <p><a href={store}>Browse the shop</a></p>}
    <div className="inline"><button type="button" onClick={() => { setElapsed(0); setStep('consent'); }}>Scan again</button><a href="/raygifts#gifts">See all gifts</a></div>
  </div>;
}

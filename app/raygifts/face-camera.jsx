import { useEffect, useRef, useState } from 'react';

export function FaceCamera({ createDetector }) {
  const video = useRef(null);
  const session = useRef(null);
  const [camera, setCamera] = useState('idle');
  const [presence, setPresence] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => () => session.current?.abort(), []);

  function stop() {
    session.current?.abort();
    session.current = null;
    setCamera('idle');
    setPresence(null);
  }

  async function start() {
    if (session.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is unavailable here.');
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;
    const preview = video.current;
    let stream;
    let detector;
    let timer;
    session.current = controller;
    setCamera('starting');
    setError('');

    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      stream?.getTracks().forEach(track => track.stop());
      preview.srcObject = null;
      detector?.dispose?.();
    }, { once: true });

    function fail(reason) {
      if (signal.aborted) return;
      stop();
      setError(reason?.name === 'NotAllowedError' ? 'Camera access was declined.' : 'The camera check is unavailable. Try again.');
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      if (signal.aborted) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      preview.srcObject = stream;
      await preview.play();
      if (signal.aborted) return;
      detector = await createDetector({ signal });
      if (signal.aborted) {
        detector?.dispose?.();
        return;
      }

      setCamera('running');
      async function checkFrame() {
        try {
          const facePresent = await detector.detect(preview, { signal });
          if (signal.aborted) return;
          setPresence(facePresent === true);
          timer = setTimeout(checkFrame, 250);
        } catch (reason) { fail(reason); }
      }
      await checkFrame();
    } catch (reason) { fail(reason); }
  }

  return <div className="camera-check">
    <button type="button" onClick={camera === 'idle' ? start : stop}>
      {camera === 'idle' ? 'Start camera check' : 'Turn off camera'}
    </button>
    <video ref={video} hidden={camera === 'idle'} aria-label="Camera preview" muted playsInline />
    <p role="status">{error || (camera === 'starting' ? 'Starting camera…' : presence === null ? '' : presence ? 'Face in frame.' : 'Move into the frame.')}</p>
  </div>;
}

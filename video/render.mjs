import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { getCompositions, renderMedia } from '@remotion/renderer';
import { prepare } from './prepare.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const output = process.env.HACKERSBAY_VIDEO_OUTPUT || resolve(directory, 'dist');
const browserExecutable = process.env.HACKERSBAY_CHROMIUM;
const selected = process.argv.slice(2);
await prepare();
await mkdir(output, { recursive: true });
const serveUrl = await bundle({ entryPoint: resolve(directory, 'src/index.jsx'), publicDir: resolve(directory, 'public') });
const compositions = await getCompositions(serveUrl, { browserExecutable });
for (const id of selected) {
  if (!compositions.some(composition => composition.id === id)) throw new Error('Unknown composition ' + id);
}
for (const composition of compositions) {
  if (selected.length && !selected.includes(composition.id)) continue;
  const file = resolve(output, composition.id + '.mp4');
  console.log('Rendering ' + file);
  await renderMedia({
    composition, serveUrl, outputLocation: file, browserExecutable,
    codec: 'h264', crf: 21, pixelFormat: 'yuv420p', concurrency: 4,
    onProgress: ({ progress }) => {
      if (progress === 1) console.log('Rendered ' + composition.id);
    }
  });
}

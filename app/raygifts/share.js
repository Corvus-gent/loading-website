import { readFile } from 'node:fs/promises';
import { resultTitle } from './ritual.js';
import { escape } from './render.js';

export async function shareImage(result) {
  if (!result) return readFile(new URL('./share.png', import.meta.url));
  const { default: sharp } = await import('sharp');
  const subtitle = escape(resultTitle(result));
  const caption = result[2] === '1' ? 'A quiet hour to give away.' : 'A quiet hour to make your own.';
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <rect width="1200" height="630" fill="#3B2A5C"/>
    <g fill="#F6EEDF"><text x="95" y="145" font-family="serif" font-size="54">Ray</text>
    <text x="95" y="309" font-family="serif" font-size="89">${subtitle}</text>
    <text x="99" y="380" font-family="sans-serif" font-size="38">${caption}</text></g>
    <path d="M858 493a112 112 0 0 1 224 0Z" fill="#F2A541"/>
    <path d="M95 493H1110" stroke="#F6EEDF" stroke-width="2"/>
  </svg>`)).png().toBuffer();
}

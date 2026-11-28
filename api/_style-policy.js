import {createHash} from 'node:crypto';

const hash = value => "'sha256-" + createHash('sha256').update(value).digest('base64') + "'";

// WebKit assigns this inline declaration to native select controls.
const selectStyle = hash('text-overflow:inherit');

export function stylePolicy(stylesheet) {
  return "style-src 'self' " + hash(stylesheet) + "; style-src-attr 'unsafe-hashes' " + selectStyle;
}

import crypto from 'node:crypto';
// Secrets never fall back to a public constant. Redis credentials are supported
// for existing installations; a dedicated SESSION_SECRET is preferred.
export function serverSecret() {
  let value = process.env.PRIVACY_SECRET || process.env.SESSION_SECRET || process.env.VOTE_SECRET
    || Object.entries(process.env).find(([key, value]) => /(?:REST_API_TOKEN|REDIS_REST_TOKEN)$/.test(key) && value)?.[1];
  if (!value && process.env.REDIS_URL) {
    try { if (new URL(process.env.REDIS_URL).password) value = process.env.REDIS_URL; } catch {}
  }
  if (!value) throw new Error('server secret missing');
  return value;
}

// Dedicated values let a database move preserve every existing signature.
const credentialSeed=()=>{
 const verified=serverSecret();
 try {if(process.env.REDIS_URL && new URL(process.env.REDIS_URL).password)return process.env.REDIS_URL;}catch{}
 return verified;
};
export const sessionSecret=()=>process.env.SESSION_SECRET||crypto.createHash('sha256').update('corvus'+credentialSeed()).digest('hex');
export const languageVoteSecret=()=>process.env.LANGUAGE_VOTE_SECRET||process.env.VOTE_SECRET||crypto.createHash('sha256').update(credentialSeed()).digest('hex');
export const musicVoteSecret=()=>process.env.MUSIC_VOTE_SECRET||process.env.VOTE_SECRET||process.env.SESSION_SECRET||credentialSeed();
export const gameSecret=()=>process.env.GAME_SECRET||process.env.SESSION_SECRET||process.env.VOTE_SECRET||credentialSeed();

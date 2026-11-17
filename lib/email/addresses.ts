// Typed entry point; plain JS is shared by Vercel functions and static browser modules.
export {ROLE_ADDRESSES, OWNER_EMAIL, SENDER_IDENTITIES, senderIdentity} from './addresses.js';
export type PublicRole = 'hello' | 'billing' | 'legion' | 'hack' | 'press' | 'security';
export type EmailStream = 'transactional' | 'marketing';

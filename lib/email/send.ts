import {sendTransactional as transactional, sendMarketing as marketing} from './send.js';
export {emailConfigured, prepareEmail, sendPrepared} from './send.js';
export interface EmailMessage { to: string | string[]; subject: string; text?: string; html?: string }
export interface DeliveryOptions { request?: typeof fetch; env?: Record<string, string | undefined>; idempotencyKey?: string }
export const sendTransactional: (message: EmailMessage, options?: DeliveryOptions) => ReturnType<typeof transactional> = transactional;
export const sendMarketing: (message: EmailMessage & {unsubscribeUrl: string}, options?: DeliveryOptions) => ReturnType<typeof marketing> = marketing;

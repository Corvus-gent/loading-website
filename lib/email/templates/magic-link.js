import {template} from './layout.js';
export const magicLink = ({url}) => template('Your Corvus login link', `Use this one-time link to sign in. If you did not request it, ignore this email.`, url, 'Sign in');

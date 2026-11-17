import {template} from './layout.js';
export const legionInvite = ({name, url}) => template('Your Legion invitation', `Welcome, ${name}. Your seat is waiting.`, url, 'Join the Legion');

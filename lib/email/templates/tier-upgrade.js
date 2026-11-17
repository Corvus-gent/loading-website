import {template} from './layout.js';
export const tierUpgrade = ({tier}) => template('Your Corvus tier is active', `Your ${tier} tier is now active. Thank you for supporting Corvus.`, 'https://corvus.gent/army/', 'Open your account');

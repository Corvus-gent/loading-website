#!/usr/bin/env node
import { deleteUserData } from './privacy-data.mjs';
const args = process.argv.slice(2), at = args.indexOf('--email');
try {
  if (at < 0 || !args[at + 1] || args.some((v, i) => i !== at + 1 && !['--email', '--dry-run'].includes(v))) throw Error('usage: node tools/delete-user-data.mjs --email address [--dry-run]');
  const dryRun = args.includes('--dry-run');
  const counts = await deleteUserData(args[at + 1], { dryRun });
  console.log(JSON.stringify({ dryRun, ...counts }));
  console.log('Counts only. Separately handle processor exports/backups and any correspondence. Anonymous votes cannot be matched to an email.');
  process.exit(0);
} catch (error) { console.error(error.message.startsWith('usage:') ? error.message : 'Deletion failed; verify credentials and the email argument. No record values were logged.'); process.exit(1); }

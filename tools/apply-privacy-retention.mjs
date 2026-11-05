#!/usr/bin/env node
import { migrateRetention } from './privacy-data.mjs';
try {
  if (process.argv.slice(2).some(arg => arg !== '--apply')) throw Error('usage');
  const dryRun = !process.argv.includes('--apply');
  console.log(JSON.stringify({ dryRun, ...await migrateRetention({ dryRun }) }));
  if (dryRun) console.log('Preview only. Deploy new writers first, then rerun with --apply using production credentials.');
  process.exit(0);
} catch { console.error('Retention migration failed. Verify credentials; no record values were logged.'); process.exit(1); }

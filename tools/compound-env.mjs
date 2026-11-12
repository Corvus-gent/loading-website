import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// Outside the repo, never logged; process env wins for tests and CI.
export function loadCompoundEnv(){const file=process.env.COMPOUND_ENV_FILE||path.join(os.homedir(),'.secrets/corvus-compound.env');if(!fs.existsSync(file))throw Error('Missing ~/.secrets/corvus-compound.env');const stat=fs.statSync(file);if(stat.mode&0o077)throw Error('Secrets file must be chmod 600');for(const line of fs.readFileSync(file,'utf8').split('\n')){const match=/^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line.trim());if(match&&!process.env[match[1]]){let value=match[2];if(/^(["']).*\1$/.test(value))value=value.slice(1,-1);process.env[match[1]]=value;}}}

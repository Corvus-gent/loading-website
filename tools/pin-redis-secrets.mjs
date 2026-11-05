#!/usr/bin/env node
// Run with the CURRENT deployment environment, before replacing Redis credentials.
// Never send this output file to GitHub or print its contents into a terminal log.
import {writeFile,realpath} from 'node:fs/promises';
import {dirname,basename,resolve,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {serverSecret,sessionSecret,languageVoteSecret,musicVoteSecret,gameSecret} from '../api/_secrets.js';
const args=process.argv.slice(2);
try {
 if(args.length!==2||args[0]!=='--output'||!args[1])throw Error('arguments');
 const root=await realpath(fileURLToPath(new URL('../',import.meta.url)));
 const destination=resolve(await realpath(dirname(resolve(args[1]))),basename(args[1]));
 const rel=relative(root,destination);
 if(!rel||(!rel.startsWith('..'+sep)&&!isAbsolute(rel)))throw Error('output must be outside repository');
 // Resolve everything before adding any of the dedicated values to the environment.
 const values={SESSION_SECRET:sessionSecret(),LANGUAGE_VOTE_SECRET:languageVoteSecret(),MUSIC_VOTE_SECRET:musicVoteSecret(),GAME_SECRET:gameSecret(),PRIVACY_SECRET:serverSecret()};
 await writeFile(destination,JSON.stringify(values,null,2)+'\n',{mode:0o600,flag:'wx'});
 console.log('Saved five current signing values to a new owner-only file. Import them as sensitive Vercel variables, then securely remove the local file. No values printed.');
} catch {console.error('Secret preparation failed. Use --output with a NEW private file outside the repository and load the current deployment environment. No secrets were logged.');process.exitCode=1;}

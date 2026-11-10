// Bundle the maintained sanitizer so Vercel does not require() its ESM parser.
import {build} from 'esbuild';
await build({stdin:{contents:"module.exports = require('sanitize-html');",resolveDir:process.cwd(),sourcefile:'sanitizer-entry.cjs'},bundle:true,platform:'node',format:'cjs',outfile:'api/_nest/sanitize-bundle.cjs',minify:true,legalComments:'eof'});

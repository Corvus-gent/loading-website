import { build } from 'esbuild';

await build({
  entryPoints: ['app/raygifts/client.jsx'],
  outfile: 'app/raygifts/client.js',
  bundle: true,
  minify: true,
  format: 'esm',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
});

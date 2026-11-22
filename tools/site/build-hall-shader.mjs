import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {prepareShader} from '@vgpu/wgsl/prepare';

const license = await readFile(new URL('../../node_modules/vgpu/LICENSE', import.meta.url), 'utf8');
await build({
  entryPoints: ['js/site/hall-shader.js'],
  outfile: 'public/site/hall-shader.js',
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2022',
  banner: {js: '/*! vgpu\n' + license + '*/'},
  plugins: [{
    name: 'vgpu-shader',
    setup(builder) {
      builder.onLoad({filter: /\.wgsl$/}, async ({path}) => ({
        loader: 'json',
        contents: JSON.stringify(prepareShader(await readFile(path, 'utf8'), 'hall-shader.wgsl')),
      }));
    },
  }],
});

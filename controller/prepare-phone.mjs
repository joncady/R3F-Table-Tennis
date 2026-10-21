import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
fs.mkdirSync(new URL('../public/',import.meta.url),{recursive:true});
for(const [source,target] of [['phone.html','controller.html'],['swing.mjs','swing.mjs'],['platform.mjs','platform.mjs']])fs.copyFileSync(new URL(source,import.meta.url),new URL(`../public/${target}`,import.meta.url));

const {build}=await import('esbuild');
await build({entryPoints:[fileURLToPath(new URL('marker-entry.mjs',import.meta.url))],outfile:fileURLToPath(new URL('../public/marker.mjs',import.meta.url)),bundle:true,format:'esm',platform:'browser',minify:true});

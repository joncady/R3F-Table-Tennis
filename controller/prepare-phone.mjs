import fs from 'node:fs';
fs.mkdirSync(new URL('../public/',import.meta.url),{recursive:true});
for(const [source,target] of [['phone.html','controller.html'],['swing.mjs','swing.mjs'],['platform.mjs','platform.mjs']])fs.copyFileSync(new URL(source,import.meta.url),new URL(`../public/${target}`,import.meta.url));

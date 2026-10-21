import {spawn} from 'node:child_process';
import {acquireRun} from './lock.mjs';
let release;try{release=await acquireRun();}catch(error){console.error(error.message);process.exit(1);}
const child=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test',...process.argv.slice(2)],{stdio:'inherit',env:process.env});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
try{const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',(code,signal)=>resolve(code??(signal?130:1)));});process.exitCode=code;}finally{await release();}

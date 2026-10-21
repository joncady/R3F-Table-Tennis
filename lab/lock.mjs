import {readFile,writeFile,unlink} from 'node:fs/promises';
const file=new URL('../.lab-run.lock',import.meta.url);
export async function activeRun(){try{const saved=JSON.parse(await readFile(file,'utf8'));process.kill(saved.pid,0);return saved;}catch{return null;}}
export async function acquireRun(){
 try{await writeFile(file,JSON.stringify({pid:process.pid,started:new Date().toISOString()}),{flag:'wx'});}
 catch(error){if(error.code!=='EEXIST')throw error;throw Error(await activeRun()?'A virtual lab run is already active. Stop it before starting another.':'A stale .lab-run.lock remains. Confirm no lab process is running, then remove that file and retry.',{cause:error});}
 return async()=>{try{const saved=JSON.parse(await readFile(file,'utf8'));if(saved.pid===process.pid)await unlink(file);}catch(error){if(error.code!=='ENOENT')throw error;}};
}

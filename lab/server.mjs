import http from 'node:http';
import {activeRun} from './lock.mjs';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const port=5191,origin=`http://127.0.0.1:${port}`,token=randomBytes(24).toString('hex');
const scenarios={smoke:[],vision:['--grep','generated camera'],phone:['--grep','shipped phone'],webcam:['--grep','session alignment'],mouse:['--grep','mouse player serves'],match:['--grep','extended:']};
let job=null,last={state:'idle',log:''};
const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const url=new URL(req.url,origin);
 if(req.method==='GET'&&url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end(`<!doctype html><meta name="viewport" content="width=device-width"><title>Virtual lab runner</title><style>body{max-width:1000px;margin:40px auto;padding:20px;background:#0b222c;color:#eef5ed;font:18px system-ui}button{padding:14px;margin:8px;background:#daf77c;color:#123;border:0;border-radius:10px}a{color:#daf77c}pre{white-space:pre-wrap;font-size:13px;max-height:60vh;overflow:auto}</style><h1>Table Tennis · Virtual lab</h1><p>Run actual browser trials. The full match runs in real time and may take several minutes. Each run replaces the latest local report.</p>${Object.keys(scenarios).map(name=>`<button data-job="${escape(name)}">${escape(name)}</button>`).join('')}<button id="stop">Stop</button><p><a href="/report/">Latest report and videos</a> · <a href="http://127.0.0.1:5190/R3F-Table-Tennis/lab/">Camera console (npm run lab)</a></p><p id="state">Idle</p><pre id="log"></pre><script>const token=${JSON.stringify(token)};for(const b of document.querySelectorAll('[data-job]'))b.onclick=()=>fetch('/run?scenario='+b.dataset.job,{method:'POST',headers:{'X-Lab-Token':token}});document.querySelector('#stop').onclick=()=>fetch('/stop',{method:'POST',headers:{'X-Lab-Token':token}});setInterval(async()=>{const s=await(await fetch('/state')).json();document.querySelector('#state').textContent=s.state;document.querySelector('#log').textContent=s.log;for(const b of document.querySelectorAll('[data-job]'))b.disabled=s.state==='running';},800);</script>`);return;}
 if(req.method==='GET'&&url.pathname==='/state'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(!job&&await activeRun()?{state:'running',log:'A CLI lab trial is running. Its report will be available when it finishes.'}:last));return;}
 if(req.method==='GET'&&url.pathname.startsWith('/report/')){
  const root=resolve('lab-report'),file=resolve(root,'.'+decodeURIComponent(url.pathname.slice('/report'.length))+(url.pathname.endsWith('/')?'index.html':''));
  if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}
  try{if(!(await stat(file)).isFile())throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webm':'video/webm','.png':'image/png','.svg':'image/svg+xml','.zip':'application/zip'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end('No report yet. Run a trial.');}return;
 }
 if(req.method==='POST'){
  if(req.headers.origin!==origin||req.headers['x-lab-token']!==token){res.writeHead(403).end();return;}
  if(url.pathname==='/stop'){job?.kill('SIGINT');res.end('Stopping');return;}
  const scenario=url.searchParams.get('scenario');if(url.pathname!=='/run'||!Object.hasOwn(scenarios,scenario)){res.writeHead(400).end();return;}
  if(job||await activeRun()){res.writeHead(409).end('A trial is running');return;}
  last={state:'running',log:'',scenario};job=spawn(process.execPath,['lab/run.mjs',...scenarios[scenario]],{env:{...process.env,LAB_EXTENDED:scenario==='match'?'1':'',FORCE_COLOR:'0'},stdio:['ignore','pipe','pipe']});
  for(const output of [job.stdout,job.stderr])output.on('data',chunk=>{last.log=(last.log+chunk).slice(-64000);});job.on('error',error=>{last.state='failed';last.log+=error.message;job=null;});job.on('exit',code=>{last.state=code===0?'passed':'failed';last.exitCode=code;job=null;});res.end('Started');return;
 }
 res.writeHead(404).end();
});
server.listen(port,'127.0.0.1',()=>console.log(`Virtual lab runner: ${origin}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{job?.kill('SIGINT');server.close();});

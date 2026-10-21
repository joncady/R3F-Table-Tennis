import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {WebSocketServer, WebSocket} from 'ws';
const root=path.dirname(fileURLToPath(import.meta.url));
const httpPort=Number(process.env.CONTROLLER_HTTP_PORT||8787),httpsPort=Number(process.env.CONTROLLER_HTTPS_PORT||8788);
const certs=path.join(root,'.certs');fs.mkdirSync(certs,{recursive:true});
const ips=Object.values(os.networkInterfaces()).flat().filter(i=>i&&i.family==='IPv4'&&!i.internal).map(i=>i.address);
const ip=process.env.CONTROLLER_IP||ips[0]||'127.0.0.1';
if(!fs.existsSync(path.join(certs,'server.crt'))||!fs.existsSync(path.join(certs,'ips'))||fs.readFileSync(path.join(certs,'ips'),'utf8')!==ips.join(',')){
 const run=args=>execFileSync('openssl',args,{cwd:certs,stdio:'ignore'});
 if(!fs.existsSync(path.join(certs,'ca.crt')))run(['req','-x509','-newkey','rsa:2048','-nodes','-keyout','ca.key','-out','ca.crt','-days','30','-subj','/CN=Ping Pong Local Controller CA','-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign,cRLSign']);
 run(['req','-newkey','rsa:2048','-nodes','-keyout','server.key','-out','server.csr','-subj','/CN=Ping Pong Controller']);
 fs.writeFileSync(path.join(certs,'ext'),`subjectAltName=DNS:localhost,IP:127.0.0.1${[...new Set([...ips,ip])].map(i=>`,IP:${i}`).join('')}\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n`);
 run(['x509','-req','-in','server.csr','-CA','ca.crt','-CAkey','ca.key','-CAcreateserial','-out','server.crt','-days','30','-extfile','ext']);fs.writeFileSync(path.join(certs,'ips'),ips.join(','));
}
for(const name of ['ca.key','server.key'])fs.chmodSync(path.join(certs,name),0o600);
const sessions=new Map();
function allowed(req){try {const u=new URL(req.headers.origin);return ['localhost','127.0.0.1',...ips,ip].includes(u.hostname);}catch{return false;}}
function handle(req,res){
 const url=new URL(req.url,'http://localhost');
 if(req.headers.origin&&allowed(req)){res.setHeader('Access-Control-Allow-Origin',req.headers.origin);res.setHeader('Vary','Origin');}
 res.setHeader('Cache-Control','no-store');
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'POST,GET,OPTIONS'});res.end();return;}
 if(url.pathname==='/session'&&req.method==='POST'){
  if(!allowed(req)){res.writeHead(403);res.end();return;}
  const room=randomBytes(12).toString('hex'),host=randomBytes(18).toString('hex');sessions.set(room,{host,clients:new Set(),created:Date.now()});
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({room,host,phoneUrl:`https://${ip}:${httpsPort}/controller.html#${room}`,certificateUrl:`http://${ip}:${httpPort}/ca.crt`}));return;
 }
 if(url.pathname==='/trial'&&req.method==='POST'){
  if(!allowed(req)||!sessions.has(url.searchParams.get('room'))){res.writeHead(403);res.end();return;}
  let raw='',size=0,tooLarge=false;
  req.on('data',chunk=>{size+=chunk.length;if(size>2_000_000){tooLarge=true;res.writeHead(413);res.end();req.destroy();}else raw+=chunk;});
  req.on('end',()=>{
   if(tooLarge)return;
   try{
    const trial=JSON.parse(raw);
    if(trial.version!==1||!['left','right'].includes(trial.hand)||!Array.isArray(trial.rows)||trial.rows.length>5000||trial.rows.length<1||!trial.rows.every(r=>Number.isFinite(r.t)&&Array.isArray(r.a)&&r.a.length===3&&r.a.every(Number.isFinite)))throw Error('Invalid trial');
    const folder=path.join(root,'.trials');fs.mkdirSync(folder,{recursive:true});
    const id=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomBytes(3).toString('hex');
    fs.writeFileSync(path.join(folder,id+'.json'),JSON.stringify({...trial,receivedAt:new Date().toISOString()},null,2));
    console.log(`Motion trial saved: ${id} (${trial.rows.length} samples, ${trial.hand}-handed${trial.partial?', partial':''})`);
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({id,samples:trial.rows.length}));
   }catch{res.writeHead(400);res.end('Invalid trial');}
  });return;
 }
 if(['/swing.mjs','/platform.mjs','/marker.mjs'].includes(url.pathname)){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(fs.readFileSync(url.pathname==='/marker.mjs'?path.join(root,'../public/marker.mjs'):path.join(root,url.pathname.slice(1))));return;}
 if(url.pathname==='/ca.crt'){res.writeHead(200,{'Content-Type':'application/x-x509-ca-cert','Content-Disposition':'attachment; filename="ping-pong-local-ca.crt"'});res.end(fs.readFileSync(path.join(certs,'ca.crt')));return;}
 if(url.pathname==='/controller.html'||url.pathname==='/') {res.writeHead(200,{'Content-Type':'text/html'});res.end(fs.readFileSync(path.join(root,'phone.html')));return;}
 res.writeHead(404);res.end('Not found');
}
const plain=http.createServer(handle),secure=https.createServer({key:fs.readFileSync(path.join(certs,'server.key')),cert:fs.readFileSync(path.join(certs,'server.crt'))},handle);
function sockets(server){const wss=new WebSocketServer({server,maxPayload:2048});wss.on('connection',(socket,req)=>{
 const url=new URL(req.url,'http://localhost'),room=sessions.get(url.searchParams.get('room'));const role=url.searchParams.get('role');
 if(!room||!['host','phone'].includes(role)||(role==='host'&&url.searchParams.get('host')!==room.host)||!allowed(req)){socket.close(1008,'Invalid pairing');return;}
 if([...room.clients].some(c=>c.role===role)){socket.close(1008,'Already connected');return;}
 socket.role=role;socket.alive=true;room.clients.add(socket);
 const send=(target,value)=>{if(target.readyState===WebSocket.OPEN&&target.bufferedAmount<8192)target.send(JSON.stringify(value));};
 const peers=()=>{for(const c of room.clients)send(c,{type:'status',connected:[...room.clients].some(p=>p!==c)});};peers();
 let lastMotion=0;
 socket.on('pong',()=>socket.alive=true);
 socket.on('message',raw=>{let m;try{m=JSON.parse(raw);}catch{return;}
  if(role==='phone'&&m.type==='motion'){
   if(Date.now()-lastMotion<12||!['x','y','yaw','pitch','roll'].every(k=>Number.isFinite(m[k])&&Math.abs(m[k])<=4))return;
   if(m.q!==undefined&&(!Array.isArray(m.q)||m.q.length!==4||!m.q.every(n=>Number.isFinite(n)&&Math.abs(n)<=1.01)||Math.abs(Math.hypot(...m.q)-1)>.05))return;
   if(m.swing!==undefined&&(!Array.isArray(m.swing)||m.swing.length!==3||!m.swing.every(n=>Number.isFinite(n)&&Math.abs(n)<=1)))return;
   lastMotion=Date.now();for(const c of room.clients)if(c.role==='host')send(c,{type:'motion',...(Number.isFinite(m.sentAt)&&m.sentAt>=0?{sentAt:m.sentAt}:{}),x:m.x,y:m.y,yaw:m.yaw,pitch:m.pitch,roll:m.roll,...(m.q?{q:m.q}:{}),...(m.swing?{swing:m.swing}:{}),...(Number.isSafeInteger(m.seq)?{seq:m.seq}:{})});
  }else if(m.type==='probe'&&Number.isFinite(m.sent)&&Number.isSafeInteger(m.id)){for(const c of room.clients)if(c!==socket)send(c,{type:'probe',id:m.id,sent:m.sent});
  }else if(role==='phone'&&['grip-ready','grip-failed','start','toss','pause','recenter','suspend','stop-recording'].includes(m.type)){for(const c of room.clients)if(c.role==='host')send(c,{type:m.type});}
  else if((role==='phone'&&['alignment-start','screen-aligned'].includes(m.type)||role==='host'&&['show-marker','sync-screen'].includes(m.type))&&typeof m.nonce==='string'&&/^[a-f0-9]{8}$/.test(m.nonce)){for(const c of room.clients)if(c!==socket)send(c,{type:m.type,nonce:m.nonce});}
  else if(role==='host'&&['align','calibrate-grip'].includes(m.type)){for(const c of room.clients)if(c.role==='phone')send(c,{type:m.type});}
  else if(role==='host'&&m.type==='game-status'&&typeof m.message==='string'&&m.message.length<=200){for(const c of room.clients)if(c.role==='phone')send(c,{type:'game-status',message:m.message});}
  else if(role==='host'&&['impact','opponent-hit'].includes(m.type)&&Number.isFinite(m.strength)){for(const c of room.clients)if(c.role==='phone')send(c,{type:m.type,strength:Math.max(0,Math.min(1,m.strength))});}
 });
 socket.on('close',()=>{room.clients.delete(socket);peers();});socket.on('error',()=>socket.close());
 });return wss;}
const servers=[sockets(plain),sockets(secure)];
const heartbeat=setInterval(()=>{for(const wss of servers)for(const c of wss.clients){if(!c.alive)c.terminate();else{c.alive=false;c.ping();}}for(const [id,s]of sessions)if(Date.now()-s.created>86400000){for(const c of s.clients)c.close();sessions.delete(id);}},15000);
plain.listen(httpPort,'0.0.0.0');secure.listen(httpsPort,'0.0.0.0',()=>console.log(`Controller relay ready. Phone HTTPS: https://${ip}:${httpsPort}/controller.html\nAndroid CA download: http://${ip}:${httpPort}/ca.crt\nDesktop relay: http://127.0.0.1:${httpPort}`));
function stop(){clearInterval(heartbeat);for(const wss of servers)for(const c of wss.clients)c.terminate();plain.close();secure.close();}process.on('SIGINT',stop);process.on('SIGTERM',stop);

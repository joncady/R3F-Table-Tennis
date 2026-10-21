import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const directory=fileURLToPath(new URL('./.trials/pose/',import.meta.url));
export default function poseTrialPlugin(){return {name:'local-pose-trial',apply:'serve',configureServer(server){
 server.middlewares.use(async(req,res,next)=>{
  const url=new URL(req.url||'/','http://localhost');
  if(!url.pathname.endsWith('/__pose-trial/latest')&&!url.pathname.endsWith('/__pose-trial')&&!url.pathname.endsWith('/__pose-trial/video'))return next();
  const local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  if(url.pathname.endsWith('/__pose-trial/latest')){
   if(!local||req.method!=='GET'||!(req.headers.origin===`http://${req.headers.host}`||(!req.headers.origin&&req.headers['sec-fetch-site']==='same-origin'))){res.writeHead(403);res.end('Local same-origin GET required');return;}
   try{const files=(await fs.readdir(directory)).filter(f=>/^pose-[0-9]+-[a-f0-9]{8}\.json$/.test(f)).sort((a,b)=>Number(b.split('-')[1])-Number(a.split('-')[1]));if(!files.length)throw Error('No trial');const bytes=await fs.readFile(path.join(directory,files[0]));res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(bytes);}catch{res.writeHead(404);res.end('No saved trial');}return;
  }
  if(!local||req.method!=='POST'||req.headers.origin!==`http://${req.headers.host}`){res.writeHead(403);res.end('Local same-origin POST required');return;}
  const video=url.pathname.endsWith('/video'),limit=video?32*1024*1024:8*1024*1024;
  try{
   const chunks=[];let size=0;
   for await(const chunk of req){size+=chunk.length;if(size>limit){res.writeHead(413);res.end('Trial too large');return;}chunks.push(chunk);}
   const bytes=Buffer.concat(chunks),data=video?null:JSON.parse(bytes.toString()),id=video?url.searchParams.get('id'):data.id,extension=video?url.searchParams.get('ext'):'json';
   if(typeof id!=='string'||!/^pose-[0-9]+-[a-f0-9]{8}$/.test(id)||!['json','webm','mp4'].includes(extension))throw Error('Invalid trial identifier');
   if(!video&&(data.kind!=='webcam-lateral-poc'||!Array.isArray(data.rows)||data.rows.length>3000))throw Error('Invalid trial data');
   await fs.mkdir(directory,{recursive:true});const filename=`${id}.${extension}`;
   await fs.writeFile(path.join(directory,filename),bytes,{flag:'wx',mode:0o600});
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({path:`controller/.trials/pose/${filename}`,bytes:bytes.length}));
  }catch(error){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}));}
 });
}};}

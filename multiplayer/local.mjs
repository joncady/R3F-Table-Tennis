import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {createMatchServer} from './server.mjs';
let active=null;
const token=()=>randomBytes(24).toString('base64url');
http.createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:5174');res.setHeader('Access-Control-Allow-Headers','content-type');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Content-Type','application/json');
 if(req.method==='OPTIONS'){res.end();return;}
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192){res.writeHead(413);res.end();return;}}
 let body={};try{body=JSON.parse(raw||'{}');}catch{res.writeHead(400);res.end('{}');return;}
 const url=new URL(req.url,'http://localhost'),reply=(code,value)=>{res.writeHead(code);res.end(JSON.stringify(value));};
 if(req.method==='POST'&&url.pathname==='/rooms'){
  if(body.key!==(process.env.LAUNCH_KEY||'local-development'))return reply(403,{error:'Use launch key: local-development'});
  if(active&&!active.stopped)return reply(409,{error:'A local match is already running'});
  const room={id:randomBytes(8).toString('hex'),invite:token(),seats:[{display:token(),phone:token()},{display:token(),phone:token()}]};
  active={room,stopped:false,joined:false};const record=active;record.game=createMatchServer({room,port:8791,onStop:()=>{record.stopped=true;}});
  return reply(201,{id:room.id,ticket:room.seats[0].display,invite:room.invite});
 }
 if(url.pathname.startsWith('/rooms/')&&active){
  if(url.pathname.endsWith('/join')){if(body.invite!==active.room.invite)return reply(403,{error:'Invalid invite'});if(active.joined)return reply(409,{error:'Invite claimed'});active.joined=true;return reply(200,{id:active.room.id,ticket:active.room.seats[1].display});}
  const side=active.room.seats.findIndex(s=>s.display===url.searchParams.get('ticket'));if(side<0)return reply(403,{error:'Invalid ticket'});
  return reply(200,{status:active.stopped?'stopped':'ready',side,wsUrl:'ws://127.0.0.1:8791',phoneToken:active.room.seats[side].phone});
 }
 reply(404,{error:'Not found'});
}).listen(8790,'127.0.0.1',()=>console.log('Local match control: http://127.0.0.1:8790 · launch key: local-development'));

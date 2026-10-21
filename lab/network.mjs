import {WebSocketServer,WebSocket} from 'ws';
// WebSocket is ordered/reliable. Model queueing/stalls, not fictional TCP packet loss.
export async function impairedRelay({target='ws://127.0.0.1:8789',latency=0,jitter=0,seed=7}={}) {
 const server=new WebSocketServer({host:'127.0.0.1',port:0,maxPayload:2048});
 await new Promise(resolve=>server.once('listening',resolve));
 const links=new Set(),timers=new Set();let stalledUntil=0,maxQueued=0,queued=0,delivered=0;
 const random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
 server.on('connection',(client,request)=>{
  const upstream=new WebSocket(target+request.url,{origin:'http://127.0.0.1'});links.add(client);links.add(upstream);
  const forward=(source,destination)=>{let next=0;source.on('message',(data)=>{
   if(queued>=256){client.close(1013,'Lab queue limit');upstream.close();return;}
   const bytes=Buffer.from(data);queued++;maxQueued=Math.max(maxQueued,queued);
   next=Math.max(next,stalledUntil,Date.now()+latency+random()*jitter);
   const timer=setTimeout(()=>{timers.delete(timer);queued--;if(destination.readyState===WebSocket.OPEN){destination.send(bytes,{binary:false});delivered++;}},Math.max(0,next-Date.now()));timers.add(timer);
  });};
  upstream.once('open',()=>{forward(client,upstream);forward(upstream,client);});
  for(const socket of [client,upstream]){socket.on('error',()=>{});socket.on('close',()=>{links.delete(socket);for(const peer of [client,upstream])if(peer.readyState===WebSocket.OPEN)peer.close();});}
 });
 return {url:`ws://127.0.0.1:${server.address().port}`,stall:ms=>{stalledUntil=Date.now()+ms;},disconnect:()=>{for(const socket of links)socket.terminate();},stats:()=>({queued,maxQueued,delivered}),close:async()=>{for(const timer of timers)clearTimeout(timer);for(const socket of links)socket.terminate();await new Promise(resolve=>server.close(resolve));}};
}

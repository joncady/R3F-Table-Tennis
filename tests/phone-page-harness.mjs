// Executes the shipped phone page with sensor/API doubles and a real WebSocket.
// This validates browser code + network protocol, not physical hardware or feel.
import fs from 'node:fs';
import vm from 'node:vm';
import {WebSocket} from 'ws';
import {detectPhone,controllerCapabilities,requestSensorAccess} from '../controller/platform.mjs';
import * as swing from '../controller/swing.mjs';
const source=fs.readFileSync(new URL('../controller/phone.html',import.meta.url),'utf8').split('<script type="module">')[1].split('</script>')[0].replace(/^import .*;\n/gm,'');
export async function phonePage({endpoint,room,token,kind='ios'}){
 const elements=new Map(),listeners=new Map(),timers=new Set();let socket,flashes=0;
 const element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',disabled:false,checked:['sound','haptic','visual'].includes(id),classList:{add(){flashes++;},remove(){}},after(){},click(){}});return elements.get(id);};
 class Socket extends WebSocket{constructor(url){super(url);socket=this;}}
 const timer=(fn,ms,repeat)=>{const handle=(repeat?setInterval:setTimeout)(fn,ms);timers.add(handle);return handle;};
 const permission={requestPermission:async()=>'granted'};
 const context={...swing,detectPhone,controllerCapabilities,requestSensorAccess,console,isSecureContext:true,navigator:{userAgent:kind==='ios'?'iPhone':'Android',platform:kind==='ios'?'iPhone':'Linux',maxTouchPoints:5,...(kind==='android'?{vibrate(){return true;}}:{})},document:{hidden:false,getElementById:element,createElement:()=>element('download'),addEventListener:(name,fn)=>listeners.set(name,fn)},location:{hash:'#'+new URLSearchParams({room,relay:endpoint,token}),protocol:'https:',host:'test.invalid'},DeviceOrientationEvent:kind==='ios'?permission:function(){},DeviceMotionEvent:kind==='ios'?permission:function(){},WebSocket:Socket,URL,URLSearchParams,Blob,performance,screen:{orientation:{angle:0}},setTimeout:(fn,ms)=>timer(fn,ms,false),clearTimeout,setInterval:(fn,ms)=>timer(fn,ms,true),clearInterval,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener(){}};
 context.window=context;vm.runInNewContext(source,context);await element('connect').onclick();
 await new Promise((resolve,reject)=>{if(socket.readyState===1)resolve();else {socket.once('open',resolve);socket.once('error',reject);}});
 return {socket,element,orientation:event=>listeners.get('deviceorientation')(event),acceleration:event=>listeners.get('devicemotion')(event),command:type=>element(type).onclick(),get flashes(){return flashes;},get status(){return element('status').textContent;},close(){for(const handle of timers){clearTimeout(handle);clearInterval(handle);}socket.close();}};
}

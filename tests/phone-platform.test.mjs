import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {detectPhone,controllerCapabilities,requestSensorAccess} from '../controller/platform.mjs';
import * as swing from '../controller/swing.mjs';
assert.deepEqual(detectPhone({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',platform:'iPhone'}),{kind:'ios',label:'iPhone'});
assert.equal(detectPhone({userAgent:'Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/130'}).kind,'android');
assert.equal(detectPhone({userAgent:'Mozilla/5.0 (iPad; CPU OS 18_0)',platform:'iPad'}).label,'iPad');
assert.equal(detectPhone({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X)',platform:'MacIntel',maxTouchPoints:5}).label,'iPad');
assert.equal(detectPhone({platform:'MacIntel',maxTouchPoints:0}).kind,'other');
let active=true;const calls=[];
const api=name=>({requestPermission(){assert.ok(active,`${name} must start inside the gesture`);calls.push(name);return Promise.resolve('granted');}});
const access=requestSensorAccess({DeviceOrientationEvent:api('orientation'),DeviceMotionEvent:api('acceleration')});
assert.deepEqual(calls,['orientation','acceleration']);active=false;await access;
await assert.rejects(requestSensorAccess({DeviceOrientationEvent:{requestPermission:()=>Promise.resolve('denied')},DeviceMotionEvent:{requestPermission:()=>Promise.resolve('granted')}}));
await assert.rejects(requestSensorAccess({}),/orientation sensors/);
await requestSensorAccess({DeviceOrientationEvent:function(){},DeviceMotionEvent:function(){}});
assert.equal(controllerCapabilities({navigator:{}}).vibration,false);
assert.equal(controllerCapabilities({navigator:{},webkitAudioContext:function(){}}).audio,true);
assert.equal(controllerCapabilities({navigator:{vibrate(){}}}).vibration,true);
const source=fs.readFileSync(new URL('../controller/phone.html',import.meta.url),'utf8').split('<script type="module">')[1].split('</script>')[0].replace(/^import .*;\n/gm,'');
async function pageScenario(kind,denied=false,screenFace=false){
 const elements=new Map(),listeners=new Map(),sockets=[],timers=[],requests=[];let gesture=true,clock=1000;
 const element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',disabled:false,checked:['sound','haptic','visual'].includes(id),classList:{add(){},remove(){}},after(){},click(){}});return elements.get(id);};
 const permission=name=>({requestPermission(){assert.ok(gesture);requests.push(name);return Promise.resolve(denied?'denied':'granted');}});
 class Socket{constructor(url){this.url=url;this.readyState=0;this.bufferedAmount=0;this.sent=[];sockets.push(this);}send(s){this.sent.push(JSON.parse(s));}close(){this.readyState=3;this.onclose?.();}}
 let pings=0;const vibrations=[];
 const audioNode=()=>({frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){return this;},start(){pings++;},stop(){}});
 class Audio{resume(){return new Promise(()=>{});}createOscillator(){return audioNode();}createGain(){return audioNode();}}
 const context={drawMarker:async()=>{},...swing,detectPhone,controllerCapabilities,requestSensorAccess,console,isSecureContext:true,navigator:{userAgent:kind==='ios'?'iPhone':'Android',platform:kind==='ios'?'iPhone':'Linux',maxTouchPoints:5,...(kind==='android'?{vibrate(n){vibrations.push(n);return true;}}:{})},document:{hidden:false,getElementById:element,createElement:()=>element('download'),addEventListener:(name,fn)=>listeners.set(name,fn)},location:{hash:'#room=test&relay=wss%3A%2F%2Fexample.test%2Fprod'+(screenFace?'&face=screen&marker=1234abcd':''),protocol:'https:',host:'example.test'},DeviceOrientationEvent:kind==='ios'?permission('orientation'):function(){},DeviceMotionEvent:kind==='ios'?permission('acceleration'):function(){},...(kind==='ios'?{webkitAudioContext:Audio}:{AudioContext:Audio}),WebSocket:Socket,URL,URLSearchParams,Blob,performance:{now:()=>clock},screen:{orientation:{angle:0}},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},setInterval:fn=>{timers.push(fn);return timers.length;},clearInterval(){},addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener(){}};
 context.window=context;
 vm.runInNewContext(source,context);
 assert.match(element('device').textContent,kind==='ios'?/iPhone detected/:/Android detected/);
 assert.equal(element('haptic').disabled,kind==='ios');
 const connected=element('connect').onclick();gesture=false;await connected;
 if(denied){assert.equal(sockets.length,0);assert.match(element('status').textContent,/denied/);assert.equal(element('connect').disabled,false);return;}
 assert.equal(sockets.length,1,'Audio startup must not block the sensor connection');
 if(kind==='ios')assert.deepEqual(requests,['orientation','acceleration']);
 const socket=sockets[0];socket.readyState=1;socket.onopen();socket.onmessage({data:JSON.stringify({type:'status',connected:true})});
 assert.match(element('status').textContent,kind==='ios'?/iPhone connected/:/Android connected/);
 listeners.get('deviceorientation')({alpha:0,beta:screenFace?90:0,gamma:0});
 assert.ok(socket.sent.some(m=>m.type==='motion'&&m.q?.length===4));if(screenFace){const m=socket.sent.find(m=>m.type==='motion');assert.ok(Math.abs(m.x)<.0001&&Math.abs(m.y)<.0001,'screen-face orientation does not bias fallback position');const normal=swing.rotateVector([0,0,1],m.q);assert.ok(normal[2]<-.99&&Math.abs(normal[1])<.001);}
 if(screenFace){
  const move=event=>{clock+=20;listeners.get('deviceorientation')(event);return socket.sent.filter(m=>m.type==='motion').at(-1).q;};
  const pose={alpha:55,beta:63,gamma:17},before=move(pose);
  socket.onmessage({data:JSON.stringify({type:'align'})});const after=move(pose);
  assert.ok(Math.abs(before.reduce((sum,v,i)=>sum+v*after[i],0))>.999999,'automatic recenter preserves face heading in a natural grip');
  element('alignCamera').onclick();assert.equal(element('syncMarker').hidden,false);socket.onmessage({data:JSON.stringify({type:'sync-screen',nonce:'ffffffff'})});assert.equal(element('syncMarker').hidden,false,'wrong session cannot dismiss marker');socket.onmessage({data:JSON.stringify({type:'sync-screen',nonce:'1234abcd'})});assert.equal(element('syncMarker').hidden,true);assert.ok(socket.sent.some(m=>m.type==='screen-aligned'&&m.nonce==='1234abcd'));
  const aimed=move(pose),normal=swing.rotateVector([0,0,1],aimed);assert.ok(Math.abs(normal[0])<.00001&&normal[2]<0,'explicit camera alignment sets the reference heading');
  socket.onmessage({data:JSON.stringify({type:'align'})});const stable=move(pose);assert.ok(Math.abs(aimed.reduce((sum,v,i)=>sum+v*stable[i],0))>.999999,'subsequent host recenter does not erase camera alignment');
 }
 element('stopRecording').onclick();assert.ok(socket.sent.some(m=>m.type==='stop-recording'));
 element('start').onclick();element('pause').onclick();element('toss').onclick();
 assert.ok(socket.sent.some(m=>m.type==='start'));
 socket.onmessage({data:JSON.stringify({type:'game-status',message:'Ready — tap Start / resume game.'})});assert.equal(element('gameStatus').textContent,'Ready — tap Start / resume game.');
 assert.ok(socket.sent.some(m=>m.type==='pause'));assert.ok(socket.sent.some(m=>m.type==='toss'));
 socket.onmessage({data:JSON.stringify({type:'align'})});assert.ok(socket.sent.some(m=>m.type==='recenter'));
 socket.onmessage({data:JSON.stringify({type:'calibrate-grip'})});assert.match(element('status').textContent,/Hold your natural paddle grip/);
 socket.onmessage({data:JSON.stringify({type:'impact',strength:.5})});assert.ok(pings>0,'received impact starts the audio oscillator');assert.equal(element('impactCount').textContent,'Paddle hits received: 1');if(kind==='android')assert.ok(vibrations.includes(25),'received impact requests a tactile pulse');
 element('quickFeedback').onclick();
 assert.equal(element('feedback').onclick(),undefined,'Visual feedback must not wait on a suspended audio context');
 context.document.hidden=true;listeners.get('visibilitychange')();assert.ok(socket.sent.some(m=>m.type==='suspend'));
 context.document.hidden=false;gesture=true;await element('connect').onclick();gesture=false;const next=sockets[1];next.readyState=1;next.onopen();socket.onclose();assert.equal(element('pause').disabled,false,'A stale socket must not disable a reconnected controller');
}
await pageScenario('ios');await pageScenario('android');await pageScenario('ios',true);await pageScenario('android',false,true);
console.log('Passed: iPhone/Android/iPad detection, capability fallback, gesture-synchronous sensor permissions, denial/retry UI, non-blocking audio, controller-page motion/commands/impact/suspend with iOS and Android API doubles. Physical iPhone testing remains required.');

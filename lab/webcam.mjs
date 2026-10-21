import {expect} from "@playwright/test";
export async function setupWebcam(game,context,request,{relay}={}){
 const errors=[];game.on('pageerror',e=>errors.push(e.message));
 await game.route('http://127.0.0.1:8787/session',async route=>{
  const response=await request.post('http://127.0.0.1:8789/session',{headers:{Origin:'http://127.0.0.1'}}),session=await response.json();
  session.wsUrl='ws://127.0.0.1:8789/';session.phoneUrl=`http://127.0.0.1:8789/controller.html#${relay?new URLSearchParams({room:session.room,relay}):session.room}`;
  await route.fulfill({json:session});
 });
 await game.addInitScript(()=>{
  navigator.mediaDevices.getUserMedia=async()=>{
   const canvas=document.createElement('canvas');canvas.width=960;canvas.height=640;const ctx=canvas.getContext('2d'),image=new Image();image.src='/R3F-Table-Tennis/lab/fixtures/player.png';await image.decode();
   const {createPuppet}=await import('/R3F-Table-Tennis/lab/puppet.mjs');const puppet=createPuppet(image);window.labArm={x:0,y:0};
   window.labCameraOffset=0;window.labCameraCovered=false;
   const loop=()=>{ctx.fillStyle='#aaa';ctx.fillRect(0,0,960,640);if(!window.labCameraCovered){if(window.labArm.x||window.labArm.y){puppet.draw(window.labArm.x,window.labArm.y);ctx.drawImage(puppet.canvas,window.labCameraOffset,0,960,640);}else ctx.drawImage(image,window.labCameraOffset,0,960,640);}if(window.labMarkerImage)ctx.drawImage(window.labMarkerImage,20,150,260,260);requestAnimationFrame(loop);};loop();
   canvas.style.cssText='position:fixed;bottom:12px;right:12px;width:240px;z-index:9999;border:2px solid #daf77c';document.body.append(canvas);
   return canvas.captureStream(30);
  };
 });
 await game.goto('?webcam&virtual-player&vision-cpu');const link=game.getByRole('link',{name:'Open controller link'});await link.waitFor();
 const phone=await context.newPage();await phone.addInitScript(()=>{for(const api of [window.DeviceOrientationEvent,window.DeviceMotionEvent])if(api)api.requestPermission=async()=>'granted';});
 await phone.goto(await link.getAttribute('href'));await phone.locator('#connect').click();await expect(phone.locator('#start')).toBeEnabled();
 await phone.evaluate(()=>{window.labSensor={alpha:0,beta:90,gamma:0,a:[0,0,0]};window.sensorTimer=setInterval(()=>{const s=window.labSensor,e=new Event('deviceorientation');Object.assign(e,{alpha:s.alpha,beta:s.beta,gamma:s.gamma});dispatchEvent(e);const m=new Event('devicemotion');Object.assign(m,{acceleration:{x:s.a[0],y:s.a[1],z:s.a[2]},accelerationIncludingGravity:{x:s.a[0],y:9.81+s.a[1],z:s.a[2]},rotationRate:{alpha:0,beta:0,gamma:0},interval:20});dispatchEvent(m);},20);});
 await phone.locator('#syncMarker').waitFor({state:'visible'});const marker=await phone.locator('#markerCanvas').evaluate(c=>c.toDataURL());
 await game.evaluate(async url=>{const image=new Image();image.src=url;await image.decode();window.labMarkerImage=image;},marker);
 await game.bringToFront();const began=Date.now();await game.getByRole('button',{name:'Enable webcam',exact:true}).click();
 await expect(phone.locator('#syncMarker')).toBeHidden({timeout:30000});
 await expect(game.getByRole('button',{name:'Pause',exact:true})).toBeVisible({timeout:30000});

 await game.evaluate(()=>window.labMarkerImage=null);
 return {phone,errors,startupMs:Date.now()-began};
}

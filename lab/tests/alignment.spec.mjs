import {test,expect} from '@playwright/test';
import QRCode from 'qrcode';
const session='tt1:lab:session';
// Real QR pixels, video frames, module worker, jsQR and production React hook.
// Delay the worker delivery, not the scanner result; no mocked detections.
async function camera(page,slow=false){
 await page.addInitScript(({slow})=>{
  const NativeWorker=window.Worker;
  window.Worker=class extends NativeWorker{
   constructor(url,options){super(url,options);this.marker=String(url).includes('marker.worker');}
   postMessage(value,transfer){if(slow&&this.marker)setTimeout(()=>super.postMessage(value,transfer),700);else super.postMessage(value,transfer);}
  };
 },{slow});
 await page.goto('lab/alignment.html');
 await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
  window.markerCanvas=canvas;window.markerContext=canvas.getContext('2d');
  const video=document.querySelector('video');video.srcObject=canvas.captureStream(15);
  window.markerRender=()=>{const c=window.markerContext;c.fillStyle='white';c.fillRect(0,0,640,480);if(window.markerImage){c.save();c.translate(320,240);c.rotate(window.markerAngle||0);const size=window.markerSize||280;c.drawImage(window.markerImage,-size/2,-size/2,size,size);c.restore();}};
  window.markerTimer=setInterval(window.markerRender,60);window.markerRender();await video.play();
 });
}
async function show(page,payload=session,{angle=0,size=280}={}){
 const url=await QRCode.toDataURL(payload,{width:360,margin:4});
 await page.evaluate(async({url,angle,size})=>{const image=new Image();image.src=url;await image.decode();window.markerImage=image;window.markerAngle=angle;window.markerSize=size;window.markerRender();},{url,angle,size});
}
test('alignment: real scanner tolerates slow frames and verifies only its session',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await camera(page,true);await show(page,'tt1:other:session');
 await expect(page.locator('p[role=status]')).toContainText('Different session');
 await expect(page.locator('output')).toHaveText('Waiting');
 await show(page,session,{angle:Math.PI/2});
 await expect(page.locator('p[role=status]')).toContainText('top edge up');
 await expect(page.locator('output')).toHaveText('Waiting');
 await show(page);
 await expect(page.locator('output')).toHaveText('Verified',{timeout:20000});
 expect(errors).toEqual([]);
});
test('alignment: lost marker replaces stale matching guidance and recovers',async({page})=>{
 await camera(page,true);await show(page);
 await expect(page.locator('p[role=status]')).toContainText('Matching session');
 await page.evaluate(()=>{window.markerImage=null;window.markerRender();});
 await expect(page.locator('p[role=status]')).toContainText('Marker not readable',{timeout:12000});
 await expect(page.locator('output')).toHaveText('Waiting');
 await show(page);await expect(page.locator('output')).toHaveText('Verified');
});

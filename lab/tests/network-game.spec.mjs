import {test,expect} from '../fixtures.mjs';
import {setupWebcam} from '../webcam.mjs';
import {impairedRelay} from '../network.mjs';
test('congested phone transport: stale motion pauses the real game and disconnect invalidates play',async({page:game,phoneContext,request},info)=>{
 const proxy=await impairedRelay({latency:80,jitter:60});
 try{
  const {phone,startupMs}=await setupWebcam(game,phoneContext,request,{relay:proxy.url});
  await expect.poll(()=>game.evaluate(()=>window.__labSnapshot?.phone)).toBeTruthy();
  proxy.stall(1800);await expect(game.getByRole('button',{name:'Play',exact:true})).toBeVisible({timeout:10000});
  const paused=await game.evaluate(()=>window.__labSnapshot);await game.waitForTimeout(250);expect(await game.evaluate(()=>window.__labSnapshot)).toEqual(paused);
  await game.waitForTimeout(2000);await expect(game.getByRole('button',{name:'Play',exact:true})).toBeVisible();
  await phone.locator('#start').click();await expect(game.getByRole('button',{name:'Pause',exact:true})).toBeVisible();
  proxy.disconnect();await expect(phone.locator('#start')).toBeDisabled();await expect(game.getByRole('button',{name:'Play',exact:true})).toBeVisible();
  await phone.locator('#connect').click();await expect(phone.locator('#syncMarker')).toBeVisible();
  await phone.locator('#markerBack').click();await phone.locator('#start').click();await expect(game.getByRole('button',{name:'Play',exact:true})).toBeVisible();
  await info.attach('transport-safety',{body:JSON.stringify({startupMs,queue:proxy.stats(),provenance:'Actual game, pose/hand/QR inference and shipped phone through ordered WS latency/jitter, 1.8s stall and reconnect. No input-state replacement.'}),contentType:'application/json'});
 }finally{await proxy.close();}
});

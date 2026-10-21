import {setupWebcam} from '../webcam.mjs';
import {test,expect} from '../fixtures.mjs';
test('phone + real webcam: session alignment, on-the-fly setup, toss, body movement and remote pause',async({page:game,phoneContext,request},info)=>{
 const {phone,errors,startupMs}=await setupWebcam(game,phoneContext,request);

 await expect.poll(()=>game.evaluate(()=>window.__labSnapshot?.ballVisible&&window.__labSnapshot.at-window.__labSnapshot.tracking.hand.at<120)).toBeTruthy();
 const before=await game.evaluate(()=>window.__labSnapshot);
 await phone.locator('#toss').click();await expect.poll(()=>game.evaluate(()=>window.__labSnapshot?.phase)).not.toBe('serve');
 await game.evaluate(()=>window.labCameraOffset=120);
 await expect.poll(()=>game.evaluate(()=>Math.abs(window.__labSnapshot?.tracking?.x||0))).toBeGreaterThan(.15);
 await phone.locator('#pause').click();await expect(game.getByRole('button',{name:'Play',exact:true})).toBeVisible();
 await phone.locator('#start').click();await expect(game.getByRole('button',{name:'Pause',exact:true})).toBeVisible();
 await game.evaluate(()=>window.labCameraCovered=true);await expect(game.getByRole('button',{name:'Play',exact:true})).toBeVisible();
 await game.evaluate(()=>window.labCameraCovered=false);await game.waitForTimeout(1500);await expect(game.getByRole('button',{name:'Play',exact:true})).toBeVisible();
 expect(errors).toEqual([]);await info.attach('webcam-phone-result',{body:JSON.stringify({startupMs,before,provenance:'Generated camera stream, actual body/hand/QR workers, shipped phone sensor events, actual relay, normal phone commands. No live state mutation. Not a physical motion accuracy trial.'},null,2),contentType:'application/json'});
});

import {test,expect} from '../fixtures.mjs';
import {setupWebcam} from '../webcam.mjs';
import {phonePlayer} from '../player.mjs';
test('animated webcam + phone player strikes a serve through real tracking',async({page:game,phoneContext,request},info)=>{
 const {phone}=await setupWebcam(game,phoneContext,request);
 let result;try{result=await phonePlayer(game,phone,{duration:25000});}finally{await info.attach('camera-and-input-diagnostics',{body:JSON.stringify(await game.evaluate(()=>({last:window.__labSnapshot,camera:window.labCameraMetrics,samples:window.labPlayerSamples}))),contentType:'application/json'});}
 await info.attach('phone-player',{body:JSON.stringify({result,samples:await game.evaluate(()=>window.labPlayerSamples),provenance:'Generated image with pixel-space arm animation; actual pose/hand models, emulated phone sensor events, real relay and normal Toss button. State observer used to aim, no ball/score writes.'}),contentType:'application/json'});
 expect(result.impactSequence).toBeGreaterThan(0);
});
test('extended: animated webcam + phone completes a match against AI',async({page:game,phoneContext,request},info)=>{
 test.skip(!process.env.LAB_EXTENDED,'Set LAB_EXTENDED=1 to record a full phone + webcam match');test.setTimeout(15*60_000);
 const {phone}=await setupWebcam(game,phoneContext,request);let result;try{result=await phonePlayer(game,phone,{duration:13*60_000,fullMatch:true});}finally{await info.attach('camera-and-input-diagnostics',{body:JSON.stringify(await game.evaluate(()=>({last:window.__labSnapshot,camera:window.labCameraMetrics,samples:window.labPlayerSamples}))),contentType:'application/json'});}
 expect(result.phase).toBe('over');expect(Math.max(...result.score)).toBeGreaterThanOrEqual(11);expect(Math.abs(result.score[0]-result.score[1])).toBeGreaterThanOrEqual(2);expect(result.impactSequence).toBeGreaterThan(0);
 await info.attach('complete-phone-match',{body:JSON.stringify({result,samples:await game.evaluate(()=>window.labPlayerSamples)}),contentType:'application/json'});
});

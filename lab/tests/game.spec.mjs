import {test,expect} from '@playwright/test';
import {mousePlayer,startMouse} from '../player.mjs';
test('mouse player serves, scores, pauses and resumes through normal controls',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('?mouse&virtual-player');await startMouse(page);

 await expect.poll(()=>page.evaluate(()=>window.__labSnapshot?.phase)).toBe('serve');
 const detached=await page.evaluate(()=>{const copy=window.__labSnapshot;copy.score[0]=999;copy.ball.x=999;return window.__labSnapshot.score[0]!==999&&window.__labSnapshot.ball.x!==999;});expect(detached).toBeTruthy();
 await mousePlayer(page);
 await expect.poll(()=>page.evaluate(()=>window.__labSnapshot?.score.reduce((a,b)=>a+b)),{timeout:80000}).toBeGreaterThan(0);
 await page.keyboard.press('Escape');await page.getByRole('heading',{name:'Game paused.'}).waitFor();
 const before=await page.evaluate(()=>window.__labSnapshot);await page.waitForTimeout(350);expect(await page.evaluate(()=>window.__labSnapshot)).toEqual(before);
 await startMouse(page,'Resume game');await expect.poll(()=>page.evaluate(()=>window.__labSnapshot?.at)).toBeGreaterThan(before.at);
 expect(errors).toEqual([]);
 await info.attach('player-observations',{body:JSON.stringify({provenance:'Read-only oracle state; bounded relative mouse DOM events, Space and UI clicks. No score/ball/AI overrides.',samples:await page.evaluate(()=>window.labPlayerSamples)},null,2),contentType:'application/json'});
});
test('extended: browser mouse player completes a legal match to 11',async({page},info)=>{
 test.skip(!process.env.LAB_EXTENDED,'Set LAB_EXTENDED=1 for full real-time match recordings');test.setTimeout(20*60_000);
 await page.goto('?mouse&virtual-player');await startMouse(page);await mousePlayer(page);
 const began=Date.now();let observedAt=0,advancedAt=Date.now(),oldScore='';
 while(Date.now()-began<18*60_000){const snapshot=await page.evaluate(()=>window.__labSnapshot);if(snapshot?.phase==='over')break;if(snapshot?.at!==observedAt){observedAt=snapshot?.at;advancedAt=Date.now();}if(Date.now()-advancedAt>15000)throw Error(`Mouse match stopped rendering in ${snapshot?.phase}: ${snapshot?.message}`);if(snapshot?.score.join(':')!==oldScore){oldScore=snapshot?.score.join(':');console.log(`Mouse match ${oldScore}; paddle contacts ${snapshot?.impacts.join(':')}`);}await page.waitForTimeout(1000);}
 expect(await page.evaluate(()=>window.__labSnapshot?.phase)).toBe('over');
 const result=await page.evaluate(()=>window.__labSnapshot);expect(Math.max(...result.score)).toBeGreaterThanOrEqual(11);expect(Math.abs(result.score[0]-result.score[1])).toBeGreaterThanOrEqual(2);
 await info.attach('complete-match',{body:JSON.stringify({result,samples:await page.evaluate(()=>window.labPlayerSamples)}),contentType:'application/json'});
});

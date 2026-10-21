import {test,expect} from '../fixtures.mjs';
test('generated camera: actual pose model tracks translation, loss and reacquisition',async({page},info)=>{
 await page.goto('lab/');await page.getByRole('button',{name:'Start real vision'}).click();
 await expect.poll(()=>page.evaluate(()=>window.labVision?.points),{timeout:60000}).toBe(33);
 await expect.poll(()=>page.evaluate(()=>window.labVision?.confidence)).toBeGreaterThan(.65);
 expect(await page.evaluate(()=>window.labRuntime.handAvailable)).toBeTruthy();
 const center=await page.evaluate(()=>window.labVision);
 await page.locator('#offset').fill('140');await page.locator('#offset').dispatchEvent('input');
 await expect.poll(()=>page.evaluate(()=>window.labVision?.shoulderX)).toBeGreaterThan(center.shoulderX+.08);
 const moved=await page.evaluate(()=>window.labVision);
 await page.getByRole('button',{name:'Cover camera'}).click();await expect.poll(()=>page.evaluate(()=>window.labVision?.points)).toBe(0);
 await page.getByRole('button',{name:'Cover camera'}).click();await expect.poll(()=>page.evaluate(()=>window.labVision?.points)).toBe(33);
 await info.attach('real-vision-measurements',{body:JSON.stringify({provenance:'Generated fictional still, translated pixels; actual CPU pose model and nested hand worker; no landmark mocks.',center,moved,reacquired:await page.evaluate(()=>window.labVision)},null,2),contentType:'application/json'});
});

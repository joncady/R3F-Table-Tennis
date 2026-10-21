import {test,expect} from '../fixtures.mjs';
test.use({hasTouch:true,isMobile:true,viewport:{width:844,height:390}});
for(const hand of ['left','right'])test(`touch ${hand} hand: independent move/swing, tap serve and cancellation`,async({page,context})=>{
 await page.goto('?mouse&virtual-player');await page.getByRole('button',{name:hand==='left'?'Left handed':'Right handed',exact:true}).click();await page.getByRole('button',{name:'Start game',exact:true}).last().click();await page.locator('.touch-wheel').waitFor();
 const cdp=await context.newCDPSession(page),touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(p=>({...p,radiusX:4,radiusY:4,force:1}))});
 const wheel=await page.locator('.touch-wheel').boundingBox(),x=wheel.x+wheel.width/2,y=wheel.y+wheel.height/2,swingX=hand==='left'?180:600;
 expect(hand==='left'?wheel.x>420:wheel.x<100).toBeTruthy();expect(await page.evaluate(()=>document.pointerLockElement)).toBeNull();
 await touch('touchStart',[{id:1,x,y}]);await touch('touchMove',[{id:1,x:x+40,y}]);
 await expect.poll(()=>page.evaluate(()=>window.__labSnapshot?.body.x)).toBeGreaterThan(.05);
 await touch('touchStart',[{id:1,x:x+40,y},{id:2,x:swingX,y:160}]);await touch('touchMove',[{id:1,x:x+40,y},{id:2,x:swingX+60,y:100}]);
 await expect.poll(()=>page.evaluate(()=>window.__labSnapshot?.input.x)).toBeGreaterThan(.3);await expect.poll(()=>page.evaluate(()=>window.__labSnapshot?.input.moveX)).toBeGreaterThan(.5);
 await touch('touchEnd',[{id:1,x:x+40,y}]);await touch('touchCancel',[]);await expect.poll(()=>page.evaluate(()=>window.__labSnapshot?.input.moveX)).toBe(0);
 expect(await page.evaluate(()=>window.__labSnapshot.phase)).toBe('serve');await page.touchscreen.tap(swingX,160);await expect.poll(()=>page.evaluate(()=>window.__labSnapshot.phase)).toBe('toss');
 await page.getByRole('button',{name:'Pause',exact:true}).click();await expect(page.locator('.touch-wheel')).toHaveCount(0);
});

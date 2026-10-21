import {test as base,expect,chromium} from '@playwright/test';
function watchErrors(context){const errors=[];const watch=page=>page.on('pageerror',error=>errors.push(error.message));context.pages().forEach(watch);context.on('page',watch);return errors;}
export const test=base.extend({
 browserErrors:[async({context},use,info)=>{const errors=watchErrors(context);await use();if(errors.length)await info.attach('browser-errors',{body:JSON.stringify(errors),contentType:'application/json'});expect(errors,'No unhandled browser exceptions').toEqual([]);},{auto:true}],
 phoneContext:async({browserName},use,info)=>{
  if(browserName!=='chromium')throw Error('The virtual sensor rig currently requires Chromium.');
  const phoneBrowser=await chromium.launch({args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--autoplay-policy=no-user-gesture-required']});
  const context=await phoneBrowser.newContext({viewport:{width:420,height:840},recordVideo:{dir:info.outputPath('phone-video')}});
  const errors=watchErrors(context);
  try{await use(context);}finally{
   const videos=context.pages().map(page=>page.video()).filter(Boolean);await context.close();await phoneBrowser.close();
   for(let i=0;i<videos.length;i++)await info.attach(`phone-screen-${i}`,{path:await videos[i].path(),contentType:'video/webm'});
   expect(errors,'No unhandled virtual phone exceptions').toEqual([]);
  }
 },
});
export {expect};

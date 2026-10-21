import {test as base,expect,chromium} from '@playwright/test';
export const test=base.extend({
 phoneContext:async({},use,info)=>{
  const phoneBrowser=await chromium.launch({args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--autoplay-policy=no-user-gesture-required']});
  const context=await phoneBrowser.newContext({viewport:{width:420,height:840},recordVideo:{dir:info.outputPath('phone-video')}});
  try{await use(context);}finally{
   const videos=context.pages().map(page=>page.video()).filter(Boolean);await context.close();await phoneBrowser.close();
   for(let i=0;i<videos.length;i++)await info.attach(`phone-screen-${i}`,{path:await videos[i].path(),contentType:'video/webm'});
  }
 },
});
export {expect};

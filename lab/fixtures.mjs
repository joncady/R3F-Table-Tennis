import {test as base,expect} from '@playwright/test';
export const test=base.extend({
 phoneContext:async({browser},use,info)=>{
  const context=await browser.newContext({viewport:{width:420,height:840},recordVideo:{dir:info.outputPath('phone-video')}});
  try{await use(context);}finally{
   const videos=context.pages().map(page=>page.video()).filter(Boolean);await context.close();
   for(let i=0;i<videos.length;i++)await info.attach(`phone-screen-${i}`,{path:await videos[i].path(),contentType:'video/webm'});
  }
 },
});
export {expect};

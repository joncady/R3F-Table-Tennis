import {rigSensors} from './rig.mjs';
export async function startMouse(page,label='Start game'){
 await page.getByRole('button',{name:label,exact:true}).last().click();
 await Promise.race([page.getByRole('button',{name:'Continue with limited mouse'}).waitFor({state:'visible',timeout:20000}),page.getByRole('button',{name:'Pause',exact:true}).waitFor({state:'visible',timeout:20000})]);
 if(await page.getByRole('button',{name:'Continue with limited mouse'}).isVisible())await page.getByRole('button',{name:'Continue with limited mouse'}).click();
 await page.getByRole('button',{name:'Pause',exact:true}).waitFor();
}
// Oracle observer, ordinary DOM input. No Match methods or live references.
export async function mousePlayer(page) {
 await page.evaluate(async()=>{
  const {flyBall,bounceBall}=await import('/R3F-Table-Tennis/src/engine.ts');
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));let lastServe=0,target={x:0,y:0};
  window.labPlayerSamples=[];
  window.labPlayerTimer=setInterval(()=>{
   const s=window.__labSnapshot;if(!s||s.phase==='over')return;
   if(s.phase==='serve'&&s.server===0&&performance.now()-lastServe>1200){lastServe=performance.now();dispatchEvent(new KeyboardEvent('keydown',{code:'Space'}));dispatchEvent(new KeyboardEvent('keyup',{code:'Space'}));}
   if(s.phase==='toss')target={x:0,y:s.timer>.90?.9:0};
   if(s.phase==='serve')target={x:0,y:0};
   if(s.phase==='rally'&&s.ball.vz>.1){const b={...s.ball};for(let t=0;t<2&&b.z<2.9;t+=1/120){const old=b.y;flyBall(b,1/120);if(old>1.58&&b.y<=1.58&&b.vy<0&&Math.abs(b.x)<=1.58&&Math.abs(b.z)<=2.78)bounceBall(b);}const hand=s.hand==='left'?-1:1,aim=s.paddles[1].x>0?-1:1;target={x:clamp((b.x-aim*.3-hand*.55-s.body.x)/2,-1,1),y:clamp((b.y-1.9)/.8,-1,1)};}
   dispatchEvent(new MouseEvent('mousemove',{movementX:clamp((target.x-s.input.x)/.009,-14,14),movementY:clamp((s.input.y-target.y)/.009,-14,14)}));
   if(!window.labPlayerSamples.length||s.at-window.labPlayerSamples.at(-1).at>250)window.labPlayerSamples.push(s);
  },20);
 });
}

export async function phonePlayer(game,phone,{duration=60000,fullMatch=false}={}){
 await game.evaluate(async()=>{
  const {flyBall,bounceBall}=await import('/R3F-Table-Tennis/src/engine.ts');
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));window.labPlayerSamples=[];let last=0,lastControlAt=performance.now(),servePlan=null;
  window.labPlayerTimer=setInterval(()=>{
   const now=performance.now(),dt=Math.min(.15,Math.max(.001,(now-lastControlAt)/1000));lastControlAt=now;
   const s=window.__labSnapshot;if(!s||s.phase==='over')return;
   if(s.phase==='point'||(s.phase==='serve'&&s.server===0)){servePlan=null;window.labArm.x*=Math.exp(-12*dt);window.labArm.y*=Math.exp(-12*dt);if(Math.abs(window.labArm.x)<.001)window.labArm.x=0;if(Math.abs(window.labArm.y)<.001)window.labArm.y=0;if(!window.labPlayerSamples.length||s.at-window.labPlayerSamples.at(-1).at>200)window.labPlayerSamples.push({...s,arm:{...window.labArm},camera:window.labCameraMetrics});return;}
   let target={x:s.paddles[0].x,y:2.2};

   if(s.phase==='toss'){
    if(!servePlan){
     const metrics=window.labCameraMetrics,span=metrics?.shoulderWidth||.18,wrist=metrics?.paddleWrist||{x:.546,y:.381};
     const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
     const dx=(wrist.x-.546)/.09,dy=(wrist.y-.381)/.13;const weight=Math.max(.4,Math.exp(-dx*dx-dy*dy)*smooth(.24,.34,wrist.y)*smooth(.495,.54,wrist.x));
     window.labRig={x:.4/span*weight,y:.4*(426/640)/span*weight};
     const remaining=Math.max(0,.68-s.timer),height=clamp(s.ball.y+s.ball.vy*remaining-4.9*remaining*remaining,1.8,3.15);
     servePlan={x0:window.labArm.x,y0:window.labArm.y,x1:clamp(window.labArm.x-(s.ball.x+Math.sign(s.ball.x-s.paddles[0].x)*.65-s.paddles[0].x)*span/.8/weight,-.27,.18),y1:clamp(window.labArm.y-(height-s.paddles[0].y)*span/(426/640*.8)/weight,-.16,.14),height};
    }
    const u=clamp(s.timer/.6,0,1),blend=u*u*(3-2*u);
    window.labArm.x=servePlan.x0+(servePlan.x1-servePlan.x0)*blend;window.labArm.y=servePlan.y0+(servePlan.y1-servePlan.y0)*blend;
    if(s.at-last>100){window.labPlayerSamples.push({...s,arm:{...window.labArm},servePlan,camera:window.labCameraMetrics});last=s.at;}return;
   }
   if(s.phase==='rally'&&s.ball.vz>0){const b={...s.ball};for(let t=0;t<2&&b.z<2.95;t+=1/120){const y=b.y;flyBall(b,1/120);if(y>1.58&&b.y<=1.58&&b.vy<0&&Math.abs(b.x)<=1.58&&Math.abs(b.z)<=2.78)bounceBall(b);}target={x:b.x,y:clamp(b.y,1.5,3.1)};}
   window.labArm.x=clamp(window.labArm.x-clamp((target.x-s.paddles[0].x)*.5*dt,-.5*dt,.5*dt),-.27,.18);
   window.labArm.y=clamp(window.labArm.y-clamp((target.y-s.paddles[0].y)*.5*dt,-.35*dt,.35*dt),-.16,.14);
   if(s.at-last>200){window.labPlayerSamples.push({...s,arm:{...window.labArm},target,camera:window.labCameraMetrics});last=s.at;}
  },50);
 });
 let tossedAt=0,previousAt=Date.now(),previousPosition=[0,0],previousVelocity=[0,0];const began=Date.now();
 let observedAt=0,advancedAt=Date.now(),serveSince=0,oldScore='',previousSensors;
 while(Date.now()-began<duration){
  const s=await game.evaluate(()=>window.__labSnapshot);if(s?.phase==='over')return s;
  if(s?.at!==observedAt){observedAt=s?.at;advancedAt=Date.now();}
  if(Date.now()-advancedAt>15000)throw Error(`Phone match stopped rendering in ${s?.phase}: ${s?.message}`);
  if(s?.phase==='serve'&&s.server===0){if(!serveSince)serveSince=Date.now();if(Date.now()-serveSince>20000)throw Error('Virtual player could not produce a tracked-hand serve within 20 seconds');}else serveSince=0;
  if(s?.score.join(':')!==oldScore){oldScore=s?.score.join(':');console.log(`Phone match ${oldScore}; paddle contacts ${s?.impacts.join(':')}`);}
  if(s?.phase==='serve'&&s.server===0&&s.ballVisible&&s.tracking?.hand&&s.at-s.tracking.hand.at<120&&Date.now()-tossedAt>1500){await phone.locator('#toss').click();tossedAt=Date.now();}
  // Derive bounded linear acceleration from the virtual hand trajectory.
  const arm=await game.evaluate(()=>({...window.labArm,rig:window.labRig||{x:2,y:1.35}})),position=[-arm.x*arm.rig.x,-arm.y*arm.rig.y],now=Date.now(),dt=Math.max(.04,Math.min(.2,(now-previousAt)/1000));
  const velocity=position.map((p,i)=>(p-previousPosition[i])/dt),acceleration=velocity.map((v,i)=>Math.max(-6,Math.min(6,(v-previousVelocity[i])/dt)));
  const sensors=rigSensors(velocity,acceleration,dt,previousSensors);previousSensors=sensors;
  await phone.evaluate(sample=>{window.labSensor=sample;},sensors);
  previousPosition=position;previousVelocity=velocity;previousAt=now;
  await game.waitForTimeout(70);
 }
 if(fullMatch)throw Error('Virtual phone player did not finish within the real-time match budget');
 return game.evaluate(()=>window.__labSnapshot);
}

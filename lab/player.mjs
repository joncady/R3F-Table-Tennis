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
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));window.labPlayerSamples=[];let last=0;
  window.labPlayerTimer=setInterval(()=>{
   const s=window.__labSnapshot;if(!s||s.phase==='over')return;
   if(s.phase==='point'){window.labArm.x*=.92;window.labArm.y*=.92;return;}
   let target={x:s.paddles[0].x,y:2.2};
   if(s.phase==='serve'&&s.server===0)target={x:s.ball.x,y:s.ball.y-.25};
   if(s.phase==='toss')target={x:s.ball.x,y:s.timer>.48?Math.min(3.15,s.ball.y):s.ball.y-.65};
   if(s.phase==='rally'&&s.ball.vz>0){const b={...s.ball};for(let t=0;t<2&&b.z<2.95;t+=1/120){const y=b.y;flyBall(b,1/120);if(y>1.58&&b.y<=1.58&&b.vy<0&&Math.abs(b.x)<=1.58&&Math.abs(b.z)<=2.78)bounceBall(b);}target={x:b.x,y:clamp(b.y,1.5,3.1)};}
   window.labArm.x=clamp(window.labArm.x-clamp((target.x-s.paddles[0].x)*.015,-.012,.012),-.27,.18);
   window.labArm.y=clamp(window.labArm.y-clamp((target.y-s.paddles[0].y)*.015,-.008,.008),-.16,.14);
   if(s.at-last>200){window.labPlayerSamples.push({...s,arm:{...window.labArm},target});last=s.at;}
  },50);
 });
 let tossedAt=0,previousAt=Date.now(),previousPosition=[0,0],previousVelocity=[0,0];const began=Date.now();
 let observedAt=0,advancedAt=Date.now(),serveSince=0,oldScore='';
 while(Date.now()-began<duration){
  const s=await game.evaluate(()=>window.__labSnapshot);if(s?.phase==='over')return s;
  if(s?.at!==observedAt){observedAt=s?.at;advancedAt=Date.now();}
  if(Date.now()-advancedAt>15000)throw Error(`Phone match stopped rendering in ${s?.phase}: ${s?.message}`);
  if(s?.phase==='serve'&&s.server===0){if(!serveSince)serveSince=Date.now();if(Date.now()-serveSince>20000)throw Error('Virtual player could not produce a tracked-hand serve within 20 seconds');}else serveSince=0;
  if(s?.score.join(':')!==oldScore){oldScore=s?.score.join(':');console.log(`Phone match ${oldScore}; paddle contacts ${s?.impacts.join(':')}`);}
  if(s?.phase==='serve'&&s.server===0&&s.tracking?.hand&&Math.abs(s.paddles[0].x-s.ball.x)<.35&&Date.now()-tossedAt>1500){await phone.locator('#toss').click();tossedAt=Date.now();}
  // Derive bounded linear acceleration from the virtual hand trajectory.
  const arm=await game.evaluate(()=>({...window.labArm})),position=[-arm.x*4,-arm.y*2.7],now=Date.now(),dt=Math.max(.04,Math.min(.2,(now-previousAt)/1000));
  const velocity=position.map((p,i)=>(p-previousPosition[i])/dt),acceleration=velocity.map((v,i)=>Math.max(-6,Math.min(6,(v-previousVelocity[i])/dt)));
  await phone.evaluate(({velocity,acceleration})=>{window.labSensor={alpha:Math.max(-8,Math.min(8,velocity[0]*3)),beta:90+Math.max(-8,Math.min(8,velocity[1]*3)),gamma:0,a:[acceleration[0],acceleration[1],0]};},{velocity,acceleration});
  previousPosition=position;previousVelocity=velocity;previousAt=now;
  await game.waitForTimeout(70);
 }
 if(fullMatch)throw Error('Virtual phone player did not finish within the real-time match budget');
 return game.evaluate(()=>window.__labSnapshot);
}

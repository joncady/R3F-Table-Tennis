import {Match, PlayerInput, flyBall, bounceBall} from './engine';
const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
// Automated test player: reads the ball and emits ordinary paddle input only.
// It cannot award points, change the ball, or weaken the opponent.
export class PracticePlayer {
 constructor(private sideBrush=0,private lift=0){}
 private clock=0;
 private target={x:0,y:0};
 input(match:Match,dt:number):PlayerInput {
  const hand=match.handedness==='left'?-1:1;
  if(match.phase==='ready')match.start();
  if(match.phase==='serve') {if(match.server===0&&match.timer>.4)match.serve();this.target={x:0,y:0};}
  if(match.phase==='toss')return {x:0,y:match.timer>.90?.9:0};
  if(match.phase==='rally'){
   this.clock-=dt;
   if(this.clock<=0){
    this.clock=.04;
    const b={...match.ball};
    if(b.vz>.1){
     for(let t=0;t<2&&b.z<2.9;t+=1/120){const old=b.y;flyBall(b,1/120);if(old>1.58&&b.y<=1.58&&b.vy<0&&Math.abs(b.x)<=1.58&&Math.abs(b.z)<=2.78)bounceBall(b);}
     const aim=match.paddles[1].x>0?-1:1;
     this.target={x:clamp((b.x-aim*.30-hand*.55)/2,-1,1),y:clamp((b.y-1.9)/.8,-1,1)};
    }
   }
  }
  const side=match.paddles[1].x>0?-1:1;
  const lateral=match.phase==='rally'&&match.ball.vz>0?side*clamp((match.ball.z-2.5)*this.sideBrush,0,.6):0;
  const brush=match.phase==='rally'&&match.ball.vz>0?clamp((match.ball.z-2.5)*this.lift,-.35,.20):0;
  return {x:0,y:0,phone:true,orientation:[0,0,0,1],swingOffset:[this.target.x*2+lateral,this.target.y*.8+brush,0]};
 }
}

export function practiceMatch(){
 let seed=12345;
 return new Match('left',()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;});
}

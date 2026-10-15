// Short-window hand displacement estimate, not room-scale inertial tracking.
export function rotateVector(v,q){
 const [x,y,z,w]=q,[vx,vy,vz]=v;
 const tx=2*(y*vz-z*vy),ty=2*(z*vx-x*vz),tz=2*(x*vy-y*vx);
 return [vx+w*tx+y*tz-z*ty,vy+w*ty+z*tx-x*tz,vz+w*tz+x*ty-y*tx];
}
export class SwingTracker {
 constructor(){this.reset();}
 reset(){this.bias=[0,0,0];this.filtered=[0,0,0];this.velocity=[0,0,0];this.offset=[0,0,0];this.calibration=0;this.quiet=0;this.stroke=0;this.samples=0;}
 update(acceleration,dt,angularSpeed=0){
  if(!acceleration.every(Number.isFinite)||!Number.isFinite(dt)||dt<=0)return [...this.offset];
  if(dt>.12){this.velocity.fill(0);this.filtered.fill(0);this.offset.fill(0);this.stroke=0;return [...this.offset];}
  dt=Math.min(dt,.04);
  if(this.calibration<.4){
   // Reject a moving calibration frame instead of learning a stroke as bias.
   if(Math.hypot(...acceleration)<.45&&angularSpeed<.12){this.calibration+=dt;this.samples++;for(let i=0;i<3;i++)this.bias[i]+=(acceleration[i]-this.bias[i])/this.samples;}
   else {this.calibration=0;this.samples=0;this.bias.fill(0);}
   return [...this.offset];
  }
  const raw=acceleration.map((v,i)=>Math.max(-25,Math.min(25,v-this.bias[i])));
  const quiet=Math.hypot(...raw)<.3&&angularSpeed<.25;
  this.quiet=quiet?this.quiet+dt:0;
  this.stroke=quiet?Math.max(0,this.stroke-dt*2):this.stroke+dt;
  const alpha=1-Math.exp(-dt*22),limits=[.8,.55,.5];
  for(let i=0;i<3;i++){
   this.filtered[i]+=(raw[i]-this.filtered[i])*alpha;
   const a=Math.abs(this.filtered[i])<.12?0:this.filtered[i];
   this.velocity[i]=(this.velocity[i]+a*dt)*Math.exp(-dt*(this.stroke>1.2?6:.65));
   this.velocity[i]=Math.max(-2.5,Math.min(2.5,this.velocity[i]));
   if(this.quiet>.15)this.velocity[i]=0;
   this.offset[i]+=this.velocity[i]*dt;
   if(this.quiet>.6)this.offset[i]*=Math.exp(-dt*2.5);
   this.offset[i]=Math.max(-limits[i],Math.min(limits[i],this.offset[i]));
   if(Math.abs(this.offset[i])>=limits[i])this.velocity[i]=0;
  }
  return [...this.offset];
 }
}

export function multiplyRotation(a,b){
 const [x,y,z,w]=a,[X,Y,Z,W]=b;
 return [w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z];
}
export function gripFrame(upVector,rightVector){
 const norm=v=>{const n=Math.hypot(...v);return n>.0001?v.map(x=>x/n):null;};
 const up=norm(upVector);if(!up)return null;
 const dot=rightVector.reduce((sum,v,i)=>sum+v*up[i],0);
 const right=norm(rightVector.map((v,i)=>v-dot*up[i]));if(!right)return null;
 const forward=[right[1]*up[2]-right[2]*up[1],right[2]*up[0]-right[0]*up[2],right[0]*up[1]-right[1]*up[0]];
 const m=[...right,...up,...forward],trace=m[0]+m[4]+m[8];let q;
 if(trace>0){const s=Math.sqrt(trace+1)*2;q=[(m[7]-m[5])/s,(m[2]-m[6])/s,(m[3]-m[1])/s,s/4];}
 else if(m[0]>m[4]&&m[0]>m[8]){const s=Math.sqrt(1+m[0]-m[4]-m[8])*2;q=[s/4,(m[1]+m[3])/s,(m[2]+m[6])/s,(m[7]-m[5])/s];}
 else if(m[4]>m[8]){const s=Math.sqrt(1+m[4]-m[0]-m[8])*2;q=[(m[1]+m[3])/s,s/4,(m[5]+m[7])/s,(m[2]-m[6])/s];}
 else {const s=Math.sqrt(1+m[8]-m[0]-m[4])*2;q=[(m[2]+m[6])/s,(m[5]+m[7])/s,s/4,(m[3]-m[1])/s];}
 const length=Math.hypot(...q);return q.map(v=>v/length);
}
export function mappedRotation(relative,basis){return multiplyRotation(multiplyRotation(basis,relative),[-basis[0],-basis[1],-basis[2],basis[3]]);}

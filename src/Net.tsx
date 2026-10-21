import {useEffect,useRef,useState} from 'react';
import {useFrame} from '@react-three/fiber';
import {BufferGeometry,Float32BufferAttribute} from 'three';
import {NET, type Match} from './engine';
/** A small damped displacement, fixed at the posts, driven by real contacts. */
export default function Net({match}:{match:Match}){
 const clock=useRef({sequence:-1,age:10});
 const [geometry]=useState(()=>{const grid:number[]=[],tape:number[]=[];const add=(x:number,y:number)=>grid.push(x,y,0);
  for(let i=0;i<=64;i++){const x=-NET.halfWidth+i*NET.halfWidth/32;add(x,NET.bottom);add(x,NET.top);}
  for(let j=0;j<=8;j++)for(let i=0;i<64;i++){const y=NET.bottom+j*(NET.top-NET.bottom)/8;add(-NET.halfWidth+i*NET.halfWidth/32,y);add(-NET.halfWidth+(i+1)*NET.halfWidth/32,y);}
  for(let i=0;i<64;i++){const a=-NET.halfWidth+i*NET.halfWidth/32,b=a+NET.halfWidth/32;for(const [x,y] of [[a,NET.top-.014],[b,NET.top-.014],[b,NET.top+.014],[a,NET.top-.014],[b,NET.top+.014],[a,NET.top+.014]])tape.push(x,y,0);}
  return [grid,tape].map(values=>{const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(values,3));g.userData.rest=values;return g;});});
 useEffect(()=>()=>geometry.forEach(g=>g.dispose()),[geometry]);
 useFrame((_state,delta)=>{const m=match.netMotion;if(clock.current.sequence!==m.sequence)clock.current={sequence:m.sequence,age:m.age};else clock.current.age=Math.max(m.age,clock.current.age+Math.min(.1,delta));const age=clock.current.age,envelope=age<1.5?Math.exp(-age*5)*Math.sin(age*32):0;
  for(const g of geometry){const p=g.getAttribute('position'),rest=g.userData.rest as number[];for(let i=0;i<p.count;i++){const x=rest[i*3],y=rest[i*3+1],posts=Math.max(0,1-(x/NET.halfWidth)**2),near=Math.exp(-(((x-m.x)/.65)**2)),height=(y-NET.bottom)/(NET.top-NET.bottom),amount=m.strength*posts*near*height;p.setXYZ(i,x,y-Math.abs(envelope)*amount*.018,envelope*amount*m.direction*.06);}p.needsUpdate=true;}
 });
 return <group name="responsive-net"><lineSegments geometry={geometry[0]} frustumCulled={false}><lineBasicMaterial color="#b6c9cd" transparent opacity={.7}/></lineSegments><mesh geometry={geometry[1]} frustumCulled={false}><meshBasicMaterial color="#eef4ea" side={2}/></mesh></group>;
}

import { forwardRef, useEffect, useState } from 'react';
import { CanvasTexture, Mesh, SRGBColorSpace } from 'three';
/** One closed sphere: the spin cue is painted on, with no intersecting shell. */
const Ball=forwardRef<Mesh,{visible:boolean}>(({visible},ref)=>{
 const [texture]=useState(()=>{const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;const context=canvas.getContext('2d')!;context.fillStyle='#fff6d5';context.fillRect(0,0,256,128);context.fillStyle='#dc6b36';context.beginPath();context.ellipse(128,64,5,8,0,0,Math.PI*2);context.fill();const map=new CanvasTexture(canvas);map.colorSpace=SRGBColorSpace;return map;});
 useEffect(()=>()=>texture.dispose(),[texture]);
 return <mesh ref={ref} visible={visible}><sphereGeometry args={[.08,32,24]}/><meshStandardMaterial map={texture} emissive="#8b6928" emissiveIntensity={.25}/></mesh>;
});
Ball.displayName='Ball';
export default Ball;

import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
// Exercise the shipped event handlers with separate pointer IDs. Browser trials
// additionally cover native pointer capture, mobile layout and the real engine.
const source=fs.readFileSync(new URL('../src/TouchControls.tsx',import.meta.url),'utf8');
let code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2020,jsx:ts.JsxEmit.React,jsxFactory:'element'}}).outputText;
code=code.replace(/import .* from 'react';/,`const {useEffect,useRef,useState,element}=globalThis.__touchHooks;`);
let cleanup;
globalThis.__touchHooks={useRef:value=>({current:value}),useState:value=>[value,()=>{}],useEffect:fn=>{cleanup=fn();},element:(type,props,...children)=>({type,props,children})};
globalThis.window={innerWidth:400,innerHeight:800};
const {default:TouchControls}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
for(const hand of ['left','right']){
 const input={current:{x:0,y:0,moveX:0,moveZ:0}};let serves=0;
 const ui=TouchControls({input,hand,serve:()=>serves++}),[swing,wheel]=ui.children;
 assert.equal(ui.props.className,`touch-controls paddle-${hand}`);
 const event=(pointerId,x,y)=>({pointerId,clientX:x,clientY:y,preventDefault(){},currentTarget:{setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:120,height:120})}});
 wheel.props.onPointerDown(event(1,120,0));assert.ok(input.current.moveX>.7&&input.current.moveZ<-.7);assert.ok(Math.hypot(input.current.moveX,input.current.moveZ)<=1.000001);
 swing.props.onPointerDown(event(2,100,200));swing.props.onPointerMove(event(2,180,120));assert.equal(input.current.x,.8);assert.equal(input.current.y,.8);assert.ok(input.current.moveX>.7,'swing preserves simultaneous movement');
 swing.props.onPointerUp(event(2,180,120));assert.equal(serves,0,'drag does not toss');
 swing.props.onPointerDown(event(3,100,200));swing.props.onPointerMove(event(3,160,200));swing.props.onPointerMove(event(3,100,200));swing.props.onPointerUp(event(3,100,200));assert.equal(serves,0,'out-and-back swing is not a tap');
 swing.props.onPointerDown(event(4,100,200));swing.props.onPointerUp(event(4,101,201));assert.equal(serves,1);
 swing.props.onPointerDown(event(5,100,200));swing.props.onPointerCancel(event(5,100,200));assert.equal(serves,1,'cancel never tosses');
 wheel.props.onPointerUp(event(99,0,0));assert.ok(input.current.moveX>.7,'other finger cannot stop wheel');wheel.props.onLostPointerCapture(event(1,0,0));assert.equal(input.current.moveX,0);assert.equal(input.current.moveZ,0);
 wheel.props.onPointerDown(event(6,120,60));cleanup();assert.equal(input.current.moveX,0,'pause/unmount stops movement');
}
delete globalThis.__touchHooks;
console.log('Passed: independent touch pointers, normalized movement, drag/tap distinction, out-and-back swing, cancellation, lost capture and pause cleanup for both hands.');

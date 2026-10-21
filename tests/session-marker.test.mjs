import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';import QRCode from 'qrcode';import jsQR from 'jsqr';
const source=ts.transpileModule(fs.readFileSync(new URL('../src/sessionMarker.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2020}}).outputText;
const {markerPayload,markerFacingCamera,MarkerGate,markerGuidance}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const expected=markerPayload('012345678901234567890123','89abcdef'),code=QRCode.create(expected,{errorCorrectionLevel:'M'}),scale=6,pad=4,width=(code.modules.size+pad*2)*scale,rgba=new Uint8ClampedArray(width*width*4).fill(255);
for(let y=0;y<width;y++)for(let x=0;x<width;x++){const mx=Math.floor(x/scale)-pad,my=Math.floor(y/scale)-pad;if(mx>=0&&my>=0&&mx<code.modules.size&&my<code.modules.size&&code.modules.get(my,mx)){const i=(y*width+x)*4;rgba[i]=rgba[i+1]=rgba[i+2]=0;}}
const decoded=jsQR(rgba,width,width,{inversionAttempts:'dontInvert'});assert.equal(decoded.data,expected);assert.ok(markerFacingCamera(decoded.location));
const gate=new MarkerGate();assert.equal(gate.update(0,expected,expected,true),false);assert.equal(gate.update(200,expected,expected,true),false);assert.equal(gate.update(300,expected,markerPayload('other','89abcdef'),true),false);assert.equal(gate.update(400,expected,expected,true),false);assert.equal(gate.update(700,expected,expected,true),false);assert.equal(gate.update(900,expected,expected,true),true);assert.equal(gate.update(2800,expected,expected,true),false,'camera gap cannot accumulate stale readiness');assert.equal(gate.update(3000,expected,expected,false),false);
const face={topLeftCorner:{x:0,y:0},topRightCorner:{x:100,y:0},bottomLeftCorner:{x:0,y:100},bottomRightCorner:{x:100,y:100}};assert.ok(markerFacingCamera(face));assert.equal(markerFacingCamera({...face,topRightCorner:{x:20,y:0},bottomRightCorner:{x:20,y:100}}),false,'edge-on marker cannot set face heading');assert.equal(markerFacingCamera({...face,topRightCorner:{x:90,y:70}}),false,'rolled marker requires top edge up');
console.log('Passed: real session QR encoding/decoding, cross-session rejection, stable marker requirement, loss reset, facing-camera and top-up checks.');

const slow=new MarkerGate();
assert.equal(slow.update(0,expected,expected,true),false);
assert.equal(slow.update(800,expected,null,false),false);
assert.equal(slow.update(1100,expected,expected,true),false);
assert.equal(slow.update(2200,expected,expected,true),true,'slow scans and brief missed decodes can align');
const misses=new MarkerGate();
assert.equal(misses.update(0,expected,expected,true),false);
assert.equal(misses.update(1900,expected,null,false),false);
assert.equal(misses.update(2000,expected,expected,true),false,'misses cannot refresh old evidence');
assert.equal(misses.update(2200,expected,expected,true),false);
assert.equal(misses.update(2400,expected,expected,true),true);
const tilted=new MarkerGate();
tilted.update(0,expected,expected,true);tilted.update(200,expected,expected,true);
assert.equal(tilted.update(400,expected,expected,false),false);
assert.equal(tilted.update(600,expected,expected,true),false,'tilt resets accumulated observations');
assert.equal(tilted.update(800,expected,expected,true),false);

assert.match(markerGuidance(expected,null,null,900),/briefly lost/);
assert.match(markerGuidance(expected,null,null,1900),/not readable/);
assert.match(markerGuidance(expected,'wrong',face,0),/Different session/);
assert.match(markerGuidance(expected,expected,face,0),/Matching session/);
const tiny=Object.fromEntries(Object.entries(face).map(([key,p])=>[key,{x:p.x/4,y:p.y/4}]));
assert.match(markerGuidance(expected,expected,tiny,0),/too small/);

const guidanceSource=ts.transpileModule(fs.readFileSync(new URL('../src/trackingGuidance.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2020}}).outputText;
const {bodyGuidance}=await import('data:text/javascript;base64,'+Buffer.from(guidanceSource).toString('base64'));
assert.match(bodyGuidance([],600),/delayed/);
assert.match(bodyGuidance([],0),/both shoulders/);
const points=[];points[11]={x:.01,y:.3,visibility:1};points[12]={x:.3,y:.3,visibility:1};
assert.match(bodyGuidance(points,0),/camera edge/);
points[11].x=.45;points[12].x=.49;assert.match(bodyGuidance(points,0),/closer/);
points[12].x=.65;assert.match(bodyGuidance(points,0),/Shoulders visible/);

assert.ok(markerFacingCamera(tiny,22.5),'native 640px camera keeps the same apparent-size requirement as 1280px scanning');
assert.match(markerGuidance(expected,expected,tiny,0,22.5),/Matching session/);

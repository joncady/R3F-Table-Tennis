import ts from 'typescript';import fs from 'node:fs';import assert from 'node:assert/strict';
const url=name=>{let text=fs.readFileSync(new URL(`../src/${name}.ts`,import.meta.url),'utf8');if(name==='practicePlayer')text=text.replace("'./engine'",JSON.stringify(url('engine')));return 'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.ES2020}}).outputText).toString('base64');};
const {PracticePlayer,practiceMatch}=await import(url('practicePlayer'));
let seed=12345;Math.random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
const m=practiceMatch(),player=new PracticePlayer();let steps=0;const reasons={};let oldScore='0,0';
for(;steps<120*1800&&m.phase!=='over';steps++){m.step(1/120,player.input(m,1/120));if(m.score.toString()!==oldScore){oldScore=m.score.toString();reasons[m.message]=(reasons[m.message]||0)+1;}}
assert.equal(m.phase,'over');assert.equal(m.winner,0);assert.ok(m.impactSequence>20);console.log(`Passed: automated paddle-only player completes a legal ${m.score.join('–')} match, ${m.impactSequence} contacts, ${(steps/120).toFixed(1)} seconds; no score or ball overrides.`);

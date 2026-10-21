import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const directory=fileURLToPath(new URL('./.trials/pose/',import.meta.url));
const requested=process.argv[2];
const files=fs.existsSync(directory)?fs.readdirSync(directory).filter(f=>f.endsWith('.json')).sort():[];
const filename=requested||files.at(-1);
if(!filename){console.error('No saved pose trials yet. Run the local ?pose guided trial first.');process.exit(1);}
const trial=JSON.parse(fs.readFileSync(path.isAbsolute(filename)?filename:path.join(directory,filename),'utf8'));
console.log('Trial:',trial.id,trial.backend,'partial:',trial.partial,'marker distance:',trial.stepCm,'cm');console.log(trial.summary);
const stages=[...new Set(trial.rows.map(r=>r.stage))];
console.table(stages.map(stage=>{const rows=trial.rows.filter(r=>r.stage===stage),end=rows.at(-1).t,visible=rows.filter(r=>r.body),valid=rows.filter(r=>r.body&&r.raw!==null),held=valid.filter(r=>r.t>end-2);const values=held.map(r=>r.raw),mean=values.length?values.reduce((a,b)=>a+b,0)/values.length:null;const sd=mean===null?null:Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/values.length);return {stage,samples:rows.length,bodyVisiblePercent:(100*visible.length/rows.length).toFixed(1),mappedPercent:(100*valid.length/rows.length).toFixed(1),last2sMean:mean?.toFixed(3)??'—',last2sStd:sd?.toFixed(3)??'—'};}));
console.log('bodyVisiblePercent measures confident pose detection; mappedPercent additionally requires neutral calibration. Initial calibration frames are not tracking failures.');
console.log('Lateral units are neutral shoulder widths. Stage labels describe requested actions; video/observed marker compliance is needed to assess accuracy and physical latency.');

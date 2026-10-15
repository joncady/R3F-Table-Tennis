import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const folder=path.join(root,'.trials');
const files=fs.readdirSync(folder).filter(f=>f.endsWith('.json')).sort().reverse();
let trial,source;
for(const f of files){const data=JSON.parse(fs.readFileSync(path.join(folder,f),'utf8'));if(!data.synthetic&&!data.partial&&data.rows.length>1){trial=data;source=f;break;}}
if(!trial)throw Error('No complete recorded trial available');
const replay={source,hand:trial.hand,basis:trial.gripBasis||[0,0,0,1],duration:trial.rows.at(-1).t,rows:trial.rows.map(r=>({t:r.t,q:r.q,offset:r.offset,stage:r.stage}))};
const destination=path.join(root,'../public/replays');fs.mkdirSync(destination,{recursive:true});fs.writeFileSync(path.join(destination,'latest.json'),JSON.stringify(replay));
console.log(`Prepared ${source}: ${replay.rows.length} samples, ${replay.duration.toFixed(1)}s. Open the game with ?replay=latest`);

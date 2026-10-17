import fs from 'node:fs';
import {spawn,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {S3Client,GetObjectCommand,PutObjectCommand} from '@aws-sdk/client-s3';
const s3=new S3Client({}),bucket=process.env.CERT_BUCKET,key='tls/caddy.tar.gz';
fs.mkdirSync('/data',{recursive:true});
try{const object=await s3.send(new GetObjectCommand({Bucket:bucket,Key:key}));fs.writeFileSync('/tmp/caddy.tar.gz',await object.Body.transformToByteArray());execFileSync('tar',['xzf','/tmp/caddy.tar.gz','-C','/data']);}catch(error){if(!['NoSuchKey','NotFound'].includes(error.name))throw error;}
let lastHash='';
async function persist(){
 try{execFileSync('tar',['czf','/tmp/caddy-save.tar.gz','-C','/data','.']);const Body=fs.readFileSync('/tmp/caddy-save.tar.gz'),hash=createHash('sha256').update(Body).digest('hex');if(hash!==lastHash){await s3.send(new PutObjectCommand({Bucket:bucket,Key:key,Body,ServerSideEncryption:'AES256'}));lastHash=hash;}}catch(error){console.error('TLS cache save failed',error.name);}
}
const caddy=spawn('/usr/bin/caddy',['run','--config','/app/multiplayer/Caddyfile'],{stdio:'inherit',env:{...process.env,XDG_DATA_HOME:'/data'}});
const game=spawn(process.execPath,['multiplayer/server.mjs'],{stdio:'inherit'});
const timer=setInterval(()=>void persist(),10000);
let ending=false;async function end(code=0){if(ending)return;ending=true;clearInterval(timer);game.kill('SIGTERM');caddy.kill('SIGTERM');await persist();process.exit(code);}
game.on('exit',code=>void end(code||0));caddy.on('exit',code=>void end(code||0));
process.on('SIGTERM',()=>void end());process.on('SIGINT',()=>void end());

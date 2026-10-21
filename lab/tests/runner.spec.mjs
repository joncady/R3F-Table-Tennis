import {test,expect} from '@playwright/test';
test('runner rejects foreign-origin commands and non-allowlisted jobs',async({request})=>{
 const html=await(await request.get('http://127.0.0.1:5191/')).text();const token=JSON.parse(html.match(/const token=("[a-f0-9]+")/)[1]);
 expect((await request.post('http://127.0.0.1:5191/run?scenario=smoke',{headers:{Origin:'https://example.org','X-Lab-Token':token}})).status()).toBe(403);
 expect((await request.post('http://127.0.0.1:5191/run?scenario=not-a-job',{headers:{Origin:'http://127.0.0.1:5191','X-Lab-Token':token}})).status()).toBe(400);
 expect((await request.post('http://127.0.0.1:5191/stop',{headers:{Origin:'http://127.0.0.1:5191'}})).status()).toBe(403);
 expect(['idle','running','passed','failed']).toContain((await(await request.get('http://127.0.0.1:5191/state')).json()).state);
});

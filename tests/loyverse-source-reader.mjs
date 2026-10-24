import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/jbg-loyverse-source-reader/index.ts',import.meta.url),'utf8'));
async function run(body,header='test-secret',method='POST',options={}){
 let handler;const calls=[];
 const ctx={Response,Request,URL,AbortSignal,TextEncoder,crypto,Deno:{env:{get:n=>({SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-admin',LOYVERSE_TOKEN:'test-source'})[n]},serve:h=>handler=h},fetch:async(url,init)=>{
 calls.push({url:String(url),init});
 if(String(url).includes('/rpc/'))return Response.json('test-secret');
 if(String(url).startsWith('https://api.loyverse.com'))return options.reject?new Response('',{status:429}):Response.json(options.shape||{inventory_levels:[{store_id:'s',variant_id:'v',in_stock:2}],cursor:null});
 return new Response(null,{status:201});
 }};vm.runInNewContext(source,ctx);
 const res=await handler(new Request('https://reader.invalid',{method,headers:header?{'x-jbg-cron-secret':header}:{},...(method==='POST'?{body:JSON.stringify(body)}:{})}));return{status:res.status,body:await res.json(),calls};
}
assert.equal((await run({},null)).status,401);
assert.equal((await run({},'bad')).status,401);
assert.equal((await run({},'test-secret','GET')).status,405);
assert.equal((await run({resource:'unknown'})).status,400);
assert.equal((await run({resource:'receipts',created_at_min:'bad'})).status,400);
assert.equal((await run({resource:'inventory',cursor:123})).status,400);
let good=await run({resource:'inventory'});assert.equal(good.status,200);assert.equal(good.body.count,1);assert.equal(good.calls.filter(x=>x.url.startsWith('https://api.loyverse.com')).length,1);assert.equal(good.calls.find(x=>x.url.startsWith('https://api.loyverse.com')).init.method,undefined);assert.ok(good.calls.find(x=>x.url.includes('jbg_loyverse_raw')).init.body.includes('s:v'));
assert.equal((await run({resource:'inventory'},'test-secret','POST',{reject:true})).status,502);
assert.equal((await run({resource:'inventory'},'test-secret','POST',{shape:{wrong:[]}})).status,502);
assert.equal((await run({resource:'items'},'test-secret','POST',{shape:{items:[{id:'i'}]}})).status,200);
console.log('10 source-reader checks passed: auth, methods, input validation, inventory shape, identity, source GET and errors.');

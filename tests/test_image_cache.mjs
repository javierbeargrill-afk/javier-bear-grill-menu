import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
const src = readFileSync(new URL('../supabase/functions/loyverse-menu/index.ts', import.meta.url), 'utf8');
const body = src.slice(src.indexOf('async function cacheImagen('), src.indexOf('async function warmCachedMenuImages('))
 .replace(/: string/g, '').replace(/: Promise<string>/g, '');
const make = new Function('fetch','createClient','crypto', body + '; return cacheImagen');
let current = 'old image', uploads = 0, sourceOk = true, uploadError = false;
const stored = new Set();
const fetchMock = async (url, options) => {
 if (options?.method === 'HEAD') return {ok:stored.has(url)};
 return {ok:sourceOk, headers:new Headers({'content-type':'image/png'}), arrayBuffer:async()=>new TextEncoder().encode(current).buffer};
};
const client = () => ({storage:{from:()=>({upload:async(path,bytes)=>{
 uploads++; const url='https://test/storage/v1/object/public/menu-images/'+path;
 if (!uploadError) stored.add(url);
 return {error:uploadError?new Error('unavailable'):null};
}})}});
const cache = make(fetchMock, client, webcrypto);
const args = ['https://api.loyverse.com/image/stable-id','item','https://test','fake-test-key'];
const first = await cache(...args);
assert.match(first,/loyverse\/content\/[a-f0-9]{64}\.png$/);
assert.equal(await cache(...args),first); assert.equal(uploads,1);
current='new image'; const next=await cache(...args);
assert.notEqual(next,first); assert.equal(uploads,2);
sourceOk=false; assert.equal(await cache(...args),args[0]);
sourceOk=true; current=''; assert.equal(await cache(...args),args[0]);
current='third image'; uploadError=true; assert.equal(await cache(...args),args[0]);
console.log('PASS: stable URL changes, immutable reuse, source/empty/upload fallbacks');

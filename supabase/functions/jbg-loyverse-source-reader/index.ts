const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type':'application/json','Cache-Control':'no-store'}});
const equal = (a:string,b:string) => {if(!a || a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;};
Deno.serve(async (req:Request) => {
  if(req.method!=='POST')return json({error:'method_not_allowed'},405);
  const base=Deno.env.get('SUPABASE_URL');const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');const token=Deno.env.get('LOYVERSE_TOKEN');
  if(!base||!key||!token)return json({error:'server_configuration_missing'},503);
  const adminHeaders={'apikey':key,'Authorization':`Bearer ${key}`,'Content-Type':'application/json'};
  const supplied=req.headers.get('x-jbg-cron-secret')||'';
  if(!supplied)return json({error:'unauthorized'},401);
  const authRes=await fetch(`${base}/rest/v1/rpc/jbg_get_menu_cron_secret`,{method:'POST',headers:adminHeaders,body:'{}'});
  if(!authRes.ok)return json({error:'authorization_unavailable'},503);
  const expected=await authRes.json();
  if(typeof expected!=='string'||!equal(supplied,expected))return json({error:'unauthorized'},401);
  let input:any;try{input=await req.json();}catch{return json({error:'invalid_json'},400);}
  const resource=input.resource||'receipts';if(!['receipts','items','inventory','payment_types'].includes(resource))return json({error:'invalid_resource'},400);
  const url=new URL(`https://api.loyverse.com/v1.0/${resource}`);url.searchParams.set('limit','250');
  if(input.cursor){if(typeof input.cursor!=='string'||input.cursor.length>512)return json({error:'invalid_cursor'},400);url.searchParams.set('cursor',input.cursor);}
  if(resource==='receipts'){
    for(const name of ['created_at_min','created_at_max']){const v=input[name];if(v){if(typeof v!=='string'||!Number.isFinite(Date.parse(v)))return json({error:'invalid_date'},400);url.searchParams.set(name,new Date(v).toISOString());}}
  }
  let source:Response;try{source=await fetch(url,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(25000)});}catch{return json({error:'source_request_failed'},502);}
  if(!source.ok)return json({error:'source_rejected',source_status:source.status},502);
  const data=await source.json();const records=data[resource];if(!Array.isArray(records))return json({error:'unexpected_source_shape'},502);
  const fetchedAt=new Date().toISOString();
  const scope={resource,created_at_min:input.created_at_min||null,created_at_max:input.created_at_max||null,cursor:input.cursor||null};
  const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(scope))));const pageKey=Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('');
  const recordRows=records.map((r:any)=>({resource,source_key:resource==='receipts'?`${r.store_id||''}:${r.receipt_number}`:resource==='inventory'?`${r.store_id||''}:${r.variant_id}`:r.id,raw:r,fetched_at:fetchedAt}));
  if(recordRows.some((r:any)=>!r.source_key||r.source_key==='undefined'))return json({error:'source_identity_missing'},502);
  if(recordRows.length){const saved=await fetch(`${base}/rest/v1/jbg_loyverse_raw?on_conflict=resource,source_key`,{method:'POST',headers:{...adminHeaders,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(recordRows)});if(!saved.ok)return json({error:'raw_store_failed',store_status:saved.status},500);}
  const savedPage=await fetch(`${base}/rest/v1/jbg_loyverse_pages?on_conflict=page_key`,{method:'POST',headers:{...adminHeaders,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({page_key:pageKey,scope,raw:data,record_count:records.length,fetched_at:fetchedAt})});
  if(!savedPage.ok)return json({error:'page_store_failed'},500);
  return json({resource,count:records.length,cursor:data.cursor||null,page_key:pageKey,fetched_at:fetchedAt});
});

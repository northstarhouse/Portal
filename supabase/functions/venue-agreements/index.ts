import { agreementPdf } from './pdf.ts';
const URL=Deno.env.get('SUPABASE_URL')!,KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BASE='https://northstarhouse.github.io/Portal/';
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-app-token','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...CORS,'Content-Type':'application/json'}});
async function rest(path:string,init:RequestInit={}){const res=await fetch(URL+'/rest/v1/'+path,{...init,headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json',...init.headers}});if(!res.ok){const error=await res.json().catch(()=>({}));throw new Error(error.message || 'Contract request failed.');}const t=await res.text();return t?JSON.parse(t):null;}
const rpc=(action:string,data:any)=>rest('rpc/venue_agreement_action',{method:'POST',body:JSON.stringify({p_action:action,p_data:data})});
async function hash(value:string){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');}
function token(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');}
const tokenHash=(value:string)=>hash('agreement-link:'+KEY+':'+value);
const codeHash=(id:string,code:string)=>hash('agreement-code:'+KEY+':'+id+':'+code);
const link=(value:string)=>BASE+'#agreement='+value;
const mask=(email:string)=>email.replace(/^(.).+(@.*)$/,'$1•••$2');
function publicRecord(record:any){return {...record,signers:(record.signers||[]).map((s:any)=>({name:s.name,email:mask(s.email),role:s.role})),recipients:(record.recipients||[]).map((s:any)=>({id:s.id,name:s.name,email:mask(s.email),role:s.role,status:s.status,signed_at:s.signed_at,signed_name:s.signed_name})),events:(record.events||[]).map((e:any)=>({action:e.action,actor:e.actor,created_at:e.created_at}))};}
async function email(to:string,subject:string,text:string){const key=Deno.env.get('RESEND_API_KEY');if(!key)throw new Error('Email delivery is not configured.');// Wedding/private-event mail comes from venue@northstarhouse.org (replies go to venue@thenorthstarhouse.org); if Resend refuses it, fall back to info@.
 const send=(from:string)=>fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({from,reply_to:'venue@thenorthstarhouse.org',to:[to],subject,text})});let r=await send('North Star House <venue@northstarhouse.org>');if(!r.ok)r=await send('North Star House <info@northstarhouse.org>');if(!r.ok)throw new Error('Email could not be delivered. The contract is saved; retry sending or copy the signing link.');}
async function mailLink(version:any,signer:any,value:string){try{const signed=signer.status==='signed';await email(signer.email,version.title+(signed?' — your agreement copy':' — signature requested'),signed?`Hello ${signer.name},\n\nYour North Star House agreement and signature record are available here:\n${link(value)}\n\nYou can review and download your copy at this personal link. No additional signature is requested.\n\nNorth Star House`:`Hello ${signer.name},\n\nPlease review version ${version.version} of your North Star House agreement and sign using your personal link:\n${link(value)}\n\nYou will receive a verification code at this email address when you are ready to sign. ${signer.role==='venue'?'The venue countersigns after all client signatures are complete.':''}\n\nThis signing request expires ${version.expires_at}.\n\nNorth Star House`);await rpc('delivery',{version_id:version.id,detail:{signer_id:signer.id,delivered:true}});return {delivered:true};}catch(e){await rpc('delivery',{version_id:version.id,detail:{signer_id:signer.id,delivered:false}});return {delivered:false,error:(e as Error).message};}}

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
 if(req.method!=='POST')return json({error:'POST required.'},405);
 try{
  const body=await req.json();const action=String(body.action||'');
  if(['view','request_code','sign','decline','client_pdf'].includes(action)){
   const raw=String(body.token||'');if(!/^[a-f0-9]{64}$/.test(raw))return json({error:'Invalid signing link.'},401);
   const th=await tokenHash(raw);const resolved=await rpc('resolve',{token_hash:th});const signer=resolved.signer;
   if(action==='view'){const result=await rpc('view',{token_hash:th});return json({...result,signer:{id:result.signer.id,name:result.signer.name,email:mask(result.signer.email),role:result.signer.role,status:result.signer.status},version:publicRecord(result.version)});}
   if(action==='client_pdf')return new Response(await agreementPdf(resolved.version),{headers:{...CORS,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="North-Star-House-agreement-v'+resolved.version.version+'.pdf"'}});
   if(signer.status!=='pending')return json({error:'This signature response is already recorded and locked. You can view or download the agreement; changes require a new version.'},409);
   if(action==='request_code'){
    const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0');
    await rpc('code',{token_hash:th,code_hash:await codeHash(signer.id,code)});
    // Never BCC verification codes to administrators or other signers.
    await email(signer.email,'Your North Star House signing verification code',`Your verification code is ${code}. It expires in 10 minutes.\n\nOnly enter this code on the North Star House agreement page. Do not share it with anyone. If you did not request this code, do not sign the agreement.`);
    return json({sent:true,email:mask(signer.email)});
   }
   const code=String(body.code||'');if(!/^\d{6}$/.test(code))return json({error:'Enter the six-digit code from your email.'},400);
   const result=await rpc(action,{token_hash:th,code_hash:await codeHash(signer.id,code),document_hash:body.document_hash,signed_name:body.signed_name,consent:body.consent===true,reason:body.reason,ip:req.headers.get('x-forwarded-for')?.split(',')[0]||null,user_agent:req.headers.get('user-agent')});
   return result.error?json(result,400):json({version:publicRecord(result),saved:true});
  }
  const staffToken=req.headers.get('x-app-token')||'';
  if(!staffToken)return json({error:'Staff sign-in required.'},403);
  const authorized=await rest('rpc/has_valid_app_session',{method:'POST',headers:{'x-app-token':staffToken},body:'{}'});
  if(authorized!==true)return json({error:'Staff session expired. Sign in again.'},403);
  if(action==='list'||action==='summary')await rpc('expire',{});
  if(action==='summary'){
   const versions=await rest('venue_agreement_versions?select=id,response_id,version,status,issued_at,expires_at,completed_at&order=version.desc');
   const signers=await rest('venue_agreement_signers?select=id,version_id,name,role,status,signed_at');
   return json(versions.map((v:any)=>({...v,recipients:signers.filter((s:any)=>s.version_id===v.id)})));
  }
  if(action==='staff_pdf'){
   const version=await rest('rpc/venue_agreement_record',{method:'POST',body:JSON.stringify({p_id:body.version_id})});if(!version)return json({error:'Agreement not found.'},404);
   return new Response(await agreementPdf(version),{headers:{...CORS,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="North-Star-House-agreement-v'+version.version+'.pdf"'}});
  }
  if(action==='issue'){
   const draft=await rest('rpc/venue_agreement_record',{method:'POST',body:JSON.stringify({p_id:body.version_id})});if(!draft)return json({error:'Draft not found.'},404);
   const values=(draft.signers||[]).map(()=>token());const hashes=await Promise.all(values.map(async(value:string)=>({hash:await tokenHash(value)})));
   const version=await rpc('issue',{version_id:body.version_id,expected_updated_at:body.expected_updated_at,tokens:hashes,expiry_days:body.expiry_days});
   const links=await Promise.all((draft.signers||[]).map(async(s:any,index:number)=>{const recipient=version.recipients.find((r:any)=>r.email===s.email.trim().toLowerCase());return {signer_id:recipient.id,name:recipient.name,email:recipient.email,url:link(values[index]),...(body.send_email===true?await mailLink(version,recipient,values[index]):{})};}));
   return json({version,links});
  }
  if(action==='link'){
   const value=token();const version=await rpc('link',{version_id:body.version_id,signer_id:body.signer_id,hash:await tokenHash(value)});const signer=version.recipients.find((s:any)=>s.id===body.signer_id);
   return json({version,links:[{signer_id:signer.id,name:signer.name,email:signer.email,url:link(value),...(body.send_email===true?await mailLink(version,signer,value):{})}]});
  }
  if(['list','draft','save','void','revoke_link'].includes(action))return json(await rpc(action,{...body,actor:'Venue staff'}));
  return json({error:'Unknown agreement action.'},400);
 }catch(e){console.error('venue-agreements',e instanceof Error?e.message:'Request failed');return json({error:e instanceof Error?e.message:'Contract request failed.'},400);}
});

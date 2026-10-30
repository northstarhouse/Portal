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
// Clients sign on their own event page (venue.northstarhouse.org); only the venue countersigner signs in the Portal.
const EVENT_PAGE='https://venue.northstarhouse.org/';
// Clients sign on their own event page: they enter their venue code there and the agreement opens first. The venue countersigner signs in the Portal.
const link=(value:string,role='client',code='')=>role==='venue'?BASE+'#agreement='+value:EVENT_PAGE+(code?'#code='+code:'');
const esc=(t:string)=>String(t||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c] as string));
function brandedHtml(headline:string,paras:string[],buttonText:string,buttonUrl:string){return `<div style="background:#e6ded0;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;"><div style="max-width:560px;margin:0 auto;background:#fdfbf7;overflow:hidden;"><div style="height:14px;background:#886c44;"></div><div style="padding:44px 40px 36px;text-align:center;"><div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:3px;color:#886c44;font-weight:bold;margin-bottom:14px;">NORTH STAR HOUSE</div><h1 style="margin:0 0 24px;font-size:30px;font-weight:400;color:#2a2420;">${esc(headline)}</h1><div style="border-top:1px solid #e5ddcf;width:60%;margin:0 auto 24px;"></div>${paras.map(p=>`<p style="margin:0 0 18px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#555;line-height:1.6;text-align:left;">${p}</p>`).join('')}${buttonUrl?`<a href="${buttonUrl}" style="display:inline-block;background:#886c44;color:#fff;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:15px;padding:16px 32px;margin-top:8px;">${esc(buttonText)}</a>`:''}<p style="margin:26px 0 0;font-family:Georgia,serif;font-size:14px;color:#444;"><i>Questions? Just reply to this email.</i></p></div></div></div>`;}
const mask=(email:string)=>email.replace(/^(.).+(@.*)$/,'$1•••$2');
function publicRecord(record:any){return {...record,signers:(record.signers||[]).map((s:any)=>({name:s.name,email:mask(s.email),role:s.role})),recipients:(record.recipients||[]).map((s:any)=>({id:s.id,name:s.name,email:mask(s.email),role:s.role,status:s.status,signed_at:s.signed_at,signed_name:s.signed_name})),events:(record.events||[]).map((e:any)=>({action:e.action,actor:e.actor,created_at:e.created_at}))};}
// How many numbered terms ("1. ..." through "18. ...") the agreement text has; each needs the client's initials.
function termCount(body:string){let next=1;for(const p of body.split(/\n{2,}/)){if(new RegExp('^'+next+'\\. ').test(p))next++;}return next-1;}
const MONTHS=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
// Venue code = wedding date written like DEC-28-2026 (also accepts DEC 28 2026, 12/28/2026, 2026-12-28) -> "2026-12-28".
function parseVenueCode(raw:string):string|null{const t=String(raw||'').trim().toUpperCase();let y:number,m:number,d:number,x:RegExpMatchArray|null;if((x=t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))){y=+x[1];m=+x[2];d=+x[3];}else{const s=t.replace(/[,.\-\/]/g,' ').replace(/\s+/g,' ').trim();if((x=s.match(/^(\d{1,2}) (\d{1,2}) (\d{4})$/))){m=+x[1];d=+x[2];y=+x[3];}else if((x=s.match(/^([A-Z]{3,9}) (\d{1,2})(?:ST|ND|RD|TH)? (\d{4})$/))){m=MONTHS.indexOf(x[1].slice(0,3))+1;d=+x[2];y=+x[3];if(!m)return null;}else return null;}const dt=new Date(Date.UTC(y,m-1,d));if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d)return null;return dt.toISOString().slice(0,10);}
// The booking's event date: live booking row first, else the pre-booking / imported record.
async function eventDateFor(responseId:string):Promise<string|null>{const inq=await rest('venue_inquiries?select=event_date&limit=1&prebooking_form_response_id=eq.'+responseId);if(inq?.[0]?.event_date)return String(inq[0].event_date).slice(0,10);const r=await rest('nsh_form_responses?select=answers&id=eq.'+responseId);const a=r?.[0]?.answers||{};const v=a.sn9urgfr||a.evp_date||a.__honeybook?.project?.project_date;if(!v)return null;const raw=String(v);return /^\d{4}-\d{2}-\d{2}/.test(raw)?raw.slice(0,10):parseVenueCode(raw);}
async function email(to:string,subject:string,text:string,copyVenue=false,html?:string){const key=Deno.env.get('RESEND_API_KEY');if(!key)throw new Error('Email delivery is not configured.');// Wedding/private-event mail comes from venue@northstarhouse.org (replies go to venue@thenorthstarhouse.org); if Resend refuses it, fall back to info@.
 const send=(from:string)=>fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({from,reply_to:'venue@thenorthstarhouse.org',to:[to],...(copyVenue?{bcc:['venue@thenorthstarhouse.org']}:{}),subject,text,...(html?{html}:{})})});let r=await send('North Star House <venue@northstarhouse.org>');if(!r.ok)r=await send('North Star House <info@northstarhouse.org>');if(!r.ok)throw new Error('Email could not be delivered. The contract is saved; retry sending or copy the signing link.');}
async function mailLink(version:any,signer:any,value:string){try{
 let venueCode='';try{const d=await eventDateFor(version.response_id);if(d){const [y,m,dd]=d.split('-');venueCode=MONTHS[+m-1]+'-'+dd+'-'+y;}}catch(_e){/* the email still goes out without the code */}
 const signed=signer.status==='signed',venue=signer.role==='venue',url=link(value,signer.role,venueCode),first=String(signer.name||'').split(' ')[0]||'there';
 const expires=version.expires_at?new Date(version.expires_at).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}):'';
 let subject:string,text:string,html:string;
 if(signed){
  subject=version.title+' — your agreement copy';
  text='Hello '+signer.name+',\n\nYour North Star House agreement and signature record are available on your event page:\n'+url+'\n\n'+(venueCode?'Your venue code: '+venueCode+'\n':'')+'Enter your venue code (your wedding date, like DEC-28-2026) to review and download your copy.\n\nNorth Star House';
  html=brandedHtml('Your Signed Agreement',['Hello '+esc(first)+', your North Star House agreement and signature record are on your event page. '+(venueCode?'Your venue code is <strong>'+venueCode+'</strong>. ':'Your venue code is your wedding date, like <strong>DEC-28-2026</strong>. ')+'Enter it to review and download your copy.'],'Open My Event Page',url);
 }else if(venue){
  subject=version.title+' — countersignature requested';
  text='Hello '+signer.name+',\n\nThe clients have signed. Please countersign version '+version.version+' here:\n'+url+'\n\nYou will receive a verification code at this email address when you are ready to sign.\n\nNorth Star House';
  html=brandedHtml('Countersignature Requested',['Hello '+esc(first)+', the clients have signed version '+version.version+' of the rental agreement. Please countersign. You will receive a verification code at this email address when you are ready.'],'Countersign Agreement',url);
 }else{
  subject='Your North Star House rental agreement is ready to sign';
  text='Hello '+signer.name+',\n\nYour North Star House rental agreement is ready. Open your event page and enter your venue code'+(venueCode?': '+venueCode:' (your wedding date, like DEC-28-2026)')+'. Your agreement will open for you to review, initial and sign:\n'+url+'\n\nYou will receive a verification code at this email address when you are ready to sign.'+(expires?' Please sign by '+expires+'.':'')+'\n\nNorth Star House';
  html=brandedHtml('Your Rental Agreement Is Ready',['Hello '+esc(first)+', your rental agreement for North Star House is ready for you to review and sign.',(venueCode?'Your venue code is <strong style="font-size:20px;letter-spacing:2px;">'+venueCode+'</strong>':'Your venue code is your wedding date, written like <strong>DEC-28-2026</strong>')+'. Open your event page and enter it. Your agreement opens first: you will read and initial each numbered term, confirm with a code we email you, and sign.'+(expires?' Please sign by '+esc(expires)+'.':'')],'Open My Event Page',url);
 }
 await email(signer.email,subject,text,true,html);
 await rpc('delivery',{version_id:version.id,detail:{signer_id:signer.id,delivered:true}});return {delivered:true};}catch(e){await rpc('delivery',{version_id:version.id,detail:{signer_id:signer.id,delivered:false}});return {delivered:false,error:(e as Error).message};}}

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
 if(req.method!=='POST')return json({error:'POST required.'},405);
 try{
  const body=await req.json();const action=String(body.action||'');
  if(['view','request_code','sign','decline','client_pdf'].includes(action)){
   const raw=String(body.token||'');if(!/^[a-f0-9]{64}$/.test(raw))return json({error:'Invalid signing link.'},401);
   const th=await tokenHash(raw);const resolved=await rpc('resolve',{token_hash:th});const signer=resolved.signer;
   if(action==='view'){const result=await rpc('view',{token_hash:th});let initials:any[]=[];try{initials=await rest('venue_agreement_initials?select=signer_id,section,initials&version_id=eq.'+result.version.id)||[];}catch(_e){/* table not created yet */}return json({...result,initials,signer:{id:result.signer.id,name:result.signer.name,email:mask(result.signer.email),role:result.signer.role,status:result.signer.status},version:publicRecord(result.version)});}
   if(action==='client_pdf')return new Response(await agreementPdf(resolved.version),{headers:{...CORS,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="North-Star-House-agreement-v'+resolved.version.version+'.pdf"'}});
   if(signer.status!=='pending')return json({error:'This signature response is already recorded and locked. You can view or download the agreement; changes require a new version.'},409);
   if(action==='request_code'){
    const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0');
    await rpc('code',{token_hash:th,code_hash:await codeHash(signer.id,code)});
    // Verification codes are copied (bcc) to the venue inbox so staff can see who is signing; never to other signers.
    await email(signer.email,'Your North Star House signing verification code',`Your verification code is ${code}. It expires in 10 minutes.\n\nOnly enter this code on the North Star House agreement page. Do not share it with anyone. If you did not request this code, do not sign the agreement.`,true);
    return json({sent:true,email:mask(signer.email)});
   }
   let initialRows:any[]=[];
   if(action==='sign'&&signer.role!=='venue'){const count=termCount(String(resolved.version?.body||''));if(count>0){const given=(body.initials&&typeof body.initials==='object')?body.initials:{};for(let n=1;n<=count;n++){const v=String((given as any)[n]||'').trim();if(!/^[A-Za-z][A-Za-z .'-]{0,5}$/.test(v))return json({error:'Please initial every numbered term before signing.'},400);initialRows.push({version_id:resolved.version.id,signer_id:signer.id,section:n,initials:v.toUpperCase()});}}}
   if(action==='sign'&&signer.role!=='venue'){const expected=await eventDateFor(resolved.version.response_id);if(!expected)return json({error:'We could not confirm the venue code for this agreement. Please contact the venue.'},400);if(parseVenueCode(String(body.venue_code||''))!==expected)return json({error:'That venue code does not match this booking. Enter your wedding date, like DEC-28-2026.'},400);}
   const code=String(body.code||'');if(!/^\d{6}$/.test(code))return json({error:'Enter the six-digit code from your email.'},400);
   const result=await rpc(action,{token_hash:th,code_hash:await codeHash(signer.id,code),document_hash:body.document_hash,signed_name:body.signed_name,consent:body.consent===true,reason:body.reason,ip:req.headers.get('x-forwarded-for')?.split(',')[0]||null,user_agent:req.headers.get('user-agent')});
   if(!result.error&&initialRows.length){try{await rest('venue_agreement_initials?on_conflict=signer_id,section',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(initialRows)});}catch(e){console.error('initials not saved',(e as Error).message);}}
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
   return json({version,links:[{signer_id:signer.id,name:signer.name,email:signer.email,url:link(value,signer.role),...(body.send_email===true?await mailLink(version,signer,value):{})}]});
  }
  if(['list','draft','save','void','revoke_link'].includes(action))return json(await rpc(action,{...body,actor:'Venue staff'}));
  return json({error:'Unknown agreement action.'},400);
 }catch(e){console.error('venue-agreements',e instanceof Error?e.message:'Request failed');return json({error:e instanceof Error?e.message:'Contract request failed.'},400);}
});

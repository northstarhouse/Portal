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
// Locked text issued before the venue signature line lost its placeholder: show the neutral wording in downloads.
const writtenDate=(iso:string)=>new Date(iso+'T12:00:00Z').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'});
// Older drafts were saved with dates like 2026-11-01; show every date written out (November 1, 2026).
const tidyBody=(t:string)=>String(t||'').replace(/\[VENUE SIGNER\s*[—-]\s*TO COMPLETE\]/g,'Venue countersigner').replace(/\b\d{4}-\d{2}-\d{2}\b/g,d=>writtenDate(d));
const EVENT_PAGE='https://venue.northstarhouse.org/';
// Clients sign on their own event page: they enter their venue code there and the agreement opens first. The venue countersigner signs in the Portal.
const link=(value:string,role='client',code='')=>role==='venue'?BASE+'#agreement='+value:EVENT_PAGE+(code?'#code='+code:'');
const esc=(t:string)=>String(t||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c] as string));
// Email headlines: capitalise each word, keeping small words lowercase unless first or last.
const SMALL_WORDS=new Set(['a','an','the','and','but','or','nor','for','of','in','on','at','to','by','up','as','vs']);
const titleCase=(t:string)=>{if(/[<&]/.test(t))return t;const w=String(t).split(' ');return w.map((x,i)=>(!x||(i>0&&i<w.length-1&&SMALL_WORDS.has(x.toLowerCase()))?x:x.charAt(0).toUpperCase()+x.slice(1))).join(' ');};
function brandedHtml(headline:string,paras:string[],buttonText:string,buttonUrl:string){return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;">${String(paras[0]||headline).replace(/<[^>]+>/g,'').slice(0,140)}</div><div style="background:#e6ded0;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;"><div style="max-width:560px;margin:0 auto;background:#fdfbf7;overflow:hidden;"><div style="height:14px;background:#886c44;"></div><div style="padding:44px 40px 36px;text-align:center;"><div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:1px;color:#886c44;font-weight:bold;margin-bottom:14px;">North Star House</div><h1 style="margin:0 0 24px;font-size:30px;font-weight:400;color:#2a2420;">${esc(titleCase(headline))}</h1><div style="border-top:1px solid #e5ddcf;width:60%;margin:0 auto 24px;"></div>${paras.map(p=>`<p style="margin:0 0 18px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#555;line-height:1.6;text-align:left;">${p}</p>`).join('')}${buttonUrl?`<a href="${buttonUrl}" style="display:inline-block;background:#886c44;color:#fff;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:15px;padding:16px 32px;margin-top:8px;">${esc(buttonText)}</a>`:''}<p style="margin:26px 0 0;font-family:Georgia,serif;font-size:14px;color:#444;"><i>Questions? Just reply to this email.</i></p></div></div></div>`;}
const mask=(email:string)=>email.replace(/^(.).+(@.*)$/,'$1•••$2');
function publicRecord(record:any){return {...record,signers:(record.signers||[]).map((s:any)=>({name:s.name,email:mask(s.email),role:s.role})),recipients:(record.recipients||[]).map((s:any)=>({id:s.id,name:s.name,email:mask(s.email),role:s.role,status:s.status,signed_at:s.signed_at,signed_name:s.signed_name})),events:(record.events||[]).map((e:any)=>({action:e.action,actor:e.actor,created_at:e.created_at}))};}
// How many numbered terms ("1. ..." through "18. ...") the agreement text has; each needs the client's initials.
function termCount(body:string){let next=1;for(const p of body.split(/\n{2,}/)){if(new RegExp('^'+next+'\\. ').test(p))next++;}return next-1;}
const MONTHS=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
// Venue code = wedding date written like DEC-28-2026 (also accepts DEC 28 2026, 12/28/2026, 2026-12-28) -> "2026-12-28".
function parseVenueCode(raw:string):string|null{const t=String(raw||'').trim().toUpperCase();let y:number,m:number,d:number,x:RegExpMatchArray|null;if((x=t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))){y=+x[1];m=+x[2];d=+x[3];}else{const s=t.replace(/[,.\-\/]/g,' ').replace(/\s+/g,' ').trim();if((x=s.match(/^(\d{1,2}) (\d{1,2}) (\d{4})$/))){m=+x[1];d=+x[2];y=+x[3];}else if((x=s.match(/^([A-Z]{3,9}) (\d{1,2})(?:ST|ND|RD|TH)? (\d{4})$/))){m=MONTHS.indexOf(x[1].slice(0,3))+1;d=+x[2];y=+x[3];if(!m)return null;}else return null;}const dt=new Date(Date.UTC(y,m-1,d));if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d)return null;return dt.toISOString().slice(0,10);}
// The booking's event date: live booking row first, else the pre-booking / imported record.
async function eventDateFor(responseId:string):Promise<string|null>{const inq=await rest('venue_inquiries?select=event_date&limit=1&prebooking_form_response_id=eq.'+responseId);if(inq?.[0]?.event_date)return String(inq[0].event_date).slice(0,10);const r=await rest('nsh_form_responses?select=answers&id=eq.'+responseId);const a=r?.[0]?.answers||{};const v=a.sn9urgfr||a.evp_date||a.__honeybook?.project?.project_date;if(!v)return null;const raw=String(v);return /^\d{4}-\d{2}-\d{2}/.test(raw)?raw.slice(0,10):parseVenueCode(raw);}
async function email(to:string|string[],subject:string,text:string,copyVenue=false,html?:string){const toList=(Array.isArray(to)?to:[to]).map(String);const key=Deno.env.get('RESEND_API_KEY');if(!key)throw new Error('Email delivery is not configured.');// Wedding/private-event mail comes from venue@northstarhouse.org (replies go to venue@thenorthstarhouse.org); if Resend refuses it, fall back to info@.
 const send=(from:string)=>fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({from,reply_to:'venue@thenorthstarhouse.org',to:toList,bcc:['venue@thenorthstarhouse.org','media@thenorthstarhouse.org'].filter(b=>!toList.some(t=>t.toLowerCase()===b.toLowerCase())),subject,text,...(html?{html}:{})})});let r=await send('North Star House <venue@northstarhouse.org>');if(!r.ok)r=await send('North Star House <info@northstarhouse.org>');if(!r.ok)throw new Error('Email could not be delivered. The contract is saved; retry sending or copy the signing link.');}
// What is still owed on the first scheduled payment: { state: 'due', cents } or { state: 'paid' }; null when there is no schedule.
async function depositFor(responseId:string):Promise<{state:string,cents?:number}|null>{try{const r=await rest('venue_inquiries?select=venue_payment_schedule(sequence,amount_cents,amount_paid_cents)&prebooking_form_response_id=eq.'+responseId);const rows=((r&&r[0]&&r[0].venue_payment_schedule)||[]).slice().sort((a:any,b:any)=>a.sequence-b.sequence);if(!rows.length)return null;const left=(rows[0].amount_cents||0)-(rows[0].amount_paid_cents||0);return left>0?{state:'due',cents:left}:{state:'paid'};}catch(_e){return null;}}
// Weddings get the Wedding Day wording and the brick; other events do not.
async function isWeddingFor(responseId:string,title:string):Promise<boolean>{try{const r=await rest('venue_inquiries?select=event_type&limit=1&prebooking_form_response_id=eq.'+responseId);if(r&&r[0]&&r[0].event_type)return /wedding/i.test(String(r[0].event_type));const f=await rest('nsh_form_responses?select=form_id&limit=1&id=eq.'+responseId);if(f&&f[0])return f[0].form_id==='a3a383f7-e1db-4344-9dec-ea879ad3406d';}catch(_e){/* fall through */}return /wedding/i.test(title);}
const joinNames=(n:string[])=>n.length<=1?(n[0]||'there'):n.slice(0,-1).join(', ')+' and '+n[n.length-1];
// The "everyone has signed" email: celebrate, say what is left (the first payment), and show what the client portal can do.
async function signedUpdateEmail(version:any,names:string[],venueCode:string,url:string){
 const pay=await depositFor(version.response_id);
 const amt=pay&&pay.cents?'$'+(pay.cents/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'';
 const wedding=await isWeddingFor(version.response_id,String(version.title||''));
 const code=venueCode||'your wedding date, written like DEC-28-2026';
 const who=joinNames(names.map(n=>esc(n)));
 const whoText=joinNames(names);
 const paid=!!(pay&&pay.state==='paid');
 const subject=paid?'You are officially booked at North Star House!':'Your agreement is fully signed! One step left to book your date';
 const stepHtml=pay&&pay.state==='paid'
  ?'Your first payment has been received, so your date is <strong>officially booked</strong>. We could not be happier!'
  :'There is just one step left to officially book your date: your first payment'+(amt?' of <strong>'+amt+'</strong>':'')+'. You can make it any time on your client portal. Open it and enter your venue code, <strong style="font-size:17px;letter-spacing:2px;">'+esc(code)+'</strong>. As soon as your payment comes in, your date is officially booked.';
 const items:string[][]=[...(paid?[]:[['Make your payments','securely online, and see your full payment schedule.']]),['Review and download your signed agreement','and signature record whenever you need them.'],['Upload your certificate of insurance.',''],['Fill out your '+(wedding?'Wedding Day':'Event Day')+' Questionnaire','with your timeline, tables and chairs, vendors and day-of contacts.']];
 if(wedding)items.push(['Choose the wording for your engraved legacy brick.','']);
 items.push(['Message our team','any time, and see your walk-through details.']);
 const list='<ul style="margin:6px 0 0;padding-left:20px;text-align:left;">'+items.map(i=>'<li style="margin:0 0 8px;text-align:left;"><strong>'+i[0]+'</strong>'+(i[1]?' '+i[1]:'')+'</li>').join('')+'</ul>';
 const text='Hello '+whoText+',\n\n'+(paid?'Congratulations, you are officially booked! Your rental agreement now has every signature it needs, and your date at North Star House is reserved for you. We could not be happier to welcome you.':'We are so excited that you have chosen North Star House for your special day! Your rental agreement now has every signature it needs, and we could not be happier to welcome you.')+'\n\n'
  +(paid?'':'There is just one step left to officially book your date: your first payment'+(amt?' of '+amt:'')+'. You can make it any time on your client portal. Open it and enter your venue code: '+code+'. As soon as your payment comes in, your date is officially booked.')
  +'\n\nTip: bookmark your client portal page so it is always one click away. Your venue code is all you need to get back in.'+'\n\nYour client portal: '+url+'\n\nHere is everything you can do there:\n'+items.map(i=>'- '+i[0]+(i[1]?' '+i[1]:'')).join('\n')
  +'\n\nWe are so excited to celebrate with you. If you have any questions at all, just reply to this email or send us a message from your portal.\n\nNorth Star House';
 const tip='<strong>Tip:</strong> bookmark your client portal page so it is always one click away. Your venue code is all you need to get back in.';
 const intro=paid?'Hello '+who+', congratulations, you are officially booked! Your rental agreement now has every signature it needs, and your date at North Star House is reserved for you. We could not be happier to welcome you.':'Hello '+who+', we are so excited that you have chosen North Star House for your special day! Your rental agreement now has every signature it needs, and we could not be happier to welcome you.';
 const html=brandedHtml(paid?'You Are Officially Booked':'Your Agreement Is Fully Signed',[intro,...(paid?[]:[stepHtml]),tip,'Here is everything you can do on your client portal:'+list,'We are so excited to celebrate with you. If you have any questions at all, just reply to this email or send us a message from your portal.'],'Open My Client Portal',url);
 return {subject,text,html};
}
// Emails both clients, in one message, that the agreement is fully signed. auto: sent by the system when the venue countersigns;
// it is skipped when the first payment is already paid, and never sent twice for the same agreement.
async function sendSignedUpdate(versionId:string,auto:boolean):Promise<any>{
 const rec=await rest('rpc/venue_agreement_record',{method:'POST',body:JSON.stringify({p_id:versionId})});
 if(!rec)return {error:'Agreement not found.',status:404};
 if(rec.status!=='completed')return {error:'Everyone has to sign first.',status:400};
 if(auto){
  // Already paid at countersigning: the same email goes out as the official "you are booked" one (no payment wording).
  const prior=await rest('activity_log?select=id&action=eq.contract_signed_update_sent&detail->>version_id=eq.'+rec.id+'&limit=1');
  if(prior&&prior.length)return {skipped:'already_sent'};
 }
 const clients=(rec.recipients||[]).filter((x:any)=>x.role!=='venue'&&x.status==='signed');
 if(!clients.length)return {error:'There are no client signers on this agreement.',status:400};
 const order=(rec.signers||[]).map((x:any)=>String(x.email||'').toLowerCase());
 clients.sort((a:any,b:any)=>order.indexOf(String(a.email).toLowerCase())-order.indexOf(String(b.email).toLowerCase()));
 let venueCode='';try{const d=await eventDateFor(rec.response_id);if(d){const [y,m,dd]=d.split('-');venueCode=MONTHS[+m-1]+'-'+dd+'-'+y;}}catch(_e){/* sent without the code */}
 const names=clients.map((x:any)=>String(x.name||'').split(' ')[0]).filter(Boolean);
 const u=await signedUpdateEmail(rec,names,venueCode,link('x','client',venueCode));
 try{await email(clients.map((x:any)=>x.email),u.subject,u.text,true,u.html);}catch(e){for(const c of clients)await rpc('delivery',{version_id:rec.id,detail:{signer_id:c.id,delivered:false}});return {delivered:false,error:(e as Error).message};}
 for(const c of clients)await rpc('delivery',{version_id:rec.id,detail:{signer_id:c.id,delivered:true}});
 try{await rest('activity_log',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({description:'Signed agreement update sent to '+joinNames(clients.map((x:any)=>x.name||x.email))+(auto?' (automatically)':''),action:'contract_signed_update_sent',tag:'Venue',detail:{version_id:rec.id,emails:clients.map((x:any)=>x.email),title:rec.title,auto}})});}catch(_e){/* the email already went out */}
 return {delivered:true,to:clients.map((x:any)=>x.email)};
}
async function mailLink(version:any,signer:any,value:string,copyTo=''){try{
 let venueCode='';try{const d=await eventDateFor(version.response_id);if(d){const [y,m,dd]=d.split('-');venueCode=MONTHS[+m-1]+'-'+dd+'-'+y;}}catch(_e){/* the email still goes out without the code */}
 const signed=signer.status==='signed',venue=signer.role==='venue',url=link(value,signer.role,venueCode),first=String(signer.name||'').split(' ')[0]||'there';
 const expires=version.expires_at?new Date(version.expires_at).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}):'';
 let subject:string,text:string,html:string;
 if(signed&&!venue&&version.status==='completed'){
  const u=await signedUpdateEmail(version,[first],venueCode,url);subject=u.subject;text=u.text;html=u.html;
 }else if(signed){
  subject=version.title+' — your agreement copy';
  text='Hello '+signer.name+',\n\nYour North Star House agreement and signature record are available on your event page:\n'+url+'\n\n'+(venueCode?'Your venue code: '+venueCode+'\n':'')+'Enter your venue code (your wedding date, like DEC-28-2026) to review and download your copy.\n\nNorth Star House';
  html=brandedHtml('Your Signed Agreement',['Hello '+esc(first)+', your North Star House agreement and signature record are on your event page. '+(venueCode?'Your venue code is <strong>'+venueCode+'</strong>. ':'Your venue code is your wedding date, like <strong>DEC-28-2026</strong>. ')+'Enter it to review and download your copy.'],'Open My Event Page',url);
 }else if(venue){
  subject=version.title+' — countersignature requested';
  text='Hello '+signer.name+',\n\nThe clients have signed. Please countersign version '+version.version+' here:\n'+url+'\n\nYou will receive a verification code at this email address when you are ready to sign.\n\nNorth Star House';
  html=brandedHtml('Countersignature Requested',['Hello '+esc(first)+', the clients have signed version '+version.version+' of the rental agreement. Please countersign. You will receive a verification code at this email address when you are ready.'],'Countersign Agreement',url);
 }else{
  subject='Your North Star House rental agreement is ready to sign';
  text='Hello '+signer.name+',\n\nWe are so happy you have chosen to book with us, and we feel honored to be part of your day. Thank you for sending in your pre-booking form.\n\nThe next step is your rental agreement, and it is ready. Open your event page and enter your venue code'+(venueCode?': '+venueCode:' (your wedding date, like DEC-28-2026)')+'. Your agreement will open for you to review, initial and sign:\n'+url+'\n\nYou will receive a verification code at this email address when you are ready to sign.'+(expires?' Please sign by '+expires+'. Your date is on a soft hold until then. If the agreement is not signed by that date, the hold is released and the date becomes available to others.':'')+'\n\nNorth Star House';
  html=brandedHtml('Your Rental Agreement Is Ready',['Hello '+esc(first)+', we are so happy you have chosen to book with us, and we feel honored to be part of your day. Thank you for sending in your pre-booking form.','The next step is your rental agreement, and it is ready for you to review and sign.',(venueCode?'Your venue code is <strong style="font-size:20px;letter-spacing:2px;">'+venueCode+'</strong>':'Your venue code is your wedding date, written like <strong>DEC-28-2026</strong>')+'. Open your event page and enter it. Your agreement opens first: you will read and initial each numbered term, confirm with a code we email you, and sign.'+(expires?' Please sign by '+esc(expires)+'. Your date is on a soft hold until then. If the agreement is not signed by that date, the hold is released and the date becomes available to others.':'')],'Open My Event Page',url);
 }
 if(copyTo){await email(copyTo,'[Copy of what '+signer.name+' receives] '+subject,'(This is a copy for the venue. It was NOT sent to '+signer.email+'.)\n\n'+text,false,html);return {delivered:true,copy:true};}
 await email(signer.email,subject,text,true,html);
 // Activity log: who got which agreement email, so the team can see it was sent.
 try{await rest('activity_log',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({description:(signed?'Signed agreement copy sent to ':venue?'Countersignature request sent to ':'Contract sent to ')+(signer.name||signer.email),action:signed?'contract_copy_sent':venue?'contract_countersign_requested':'contract_sent',tag:'Venue',detail:{version_id:version.id,signer_id:signer.id,email:signer.email,title:version.title}})});}catch(_e){/* the email already went out */}
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
   if(action==='client_pdf')return new Response(await agreementPdf({...resolved.version,body:tidyBody(resolved.version.body)}),{headers:{...CORS,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="North-Star-House-agreement-v'+resolved.version.version+'.pdf"'}});
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
   return new Response(await agreementPdf({...version,body:tidyBody(version.body)}),{headers:{...CORS,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="North-Star-House-agreement-v'+version.version+'.pdf"'}});
  }
  if(action==='issue'){
   const draft=await rest('rpc/venue_agreement_record',{method:'POST',body:JSON.stringify({p_id:body.version_id})});if(!draft)return json({error:'Draft not found.'},404);
   const values=(draft.signers||[]).map(()=>token());const hashes=await Promise.all(values.map(async(value:string)=>({hash:await tokenHash(value)})));
   const version=await rpc('issue',{version_id:body.version_id,expected_updated_at:body.expected_updated_at,tokens:hashes,expiry_days:body.expiry_days});
   const links=await Promise.all((draft.signers||[]).map(async(s:any,index:number)=>{const recipient=version.recipients.find((r:any)=>r.email===s.email.trim().toLowerCase());return {signer_id:recipient.id,name:recipient.name,email:recipient.email,url:link(values[index]),...(body.send_email===true&&recipient.role!=='venue'?await mailLink(version,recipient,values[index]):{})};}));
   return json({version,links});
  }
  // The venue countersigner is already signed in to the Portal, so no emailed code: the server runs the same
  // challenge-and-sign steps itself with a one-time code that is never sent anywhere.
  if(action==='countersign'){
   const vid=String(body.version_id||''),sid=String(body.signer_id||'');
   const vs=await rest('venue_agreement_versions?select=id,status,document_hash&id=eq.'+encodeURIComponent(vid));const ver=vs?.[0];
   if(!ver)return json({error:'Agreement not found.'},404);
   const ss=await rest('venue_agreement_signers?select=id,role,status&id=eq.'+encodeURIComponent(sid)+'&version_id=eq.'+encodeURIComponent(vid));const sg=ss?.[0];
   if(!sg||sg.role!=='venue')return json({error:'Only the venue countersigner can sign here.'},400);
   const value=token(),hash=await tokenHash(value);
   await rpc('link',{version_id:vid,signer_id:sid,hash});
   const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0'),ch=await codeHash(sid,code);
   await rpc('code',{token_hash:hash,code_hash:ch});
   const result=await rpc('sign',{token_hash:hash,code_hash:ch,document_hash:ver.document_hash,signed_name:body.signed_name,consent:body.consent===true,ip:req.headers.get('x-forwarded-for')?.split(',')[0]||null,user_agent:req.headers.get('user-agent')});
   if(!result.error){try{await sendSignedUpdate(vid,true);}catch(e){console.error('automatic signed update',(e as Error).message);}}
   return result.error?json(result,400):json({version:publicRecord(result),saved:true});
  }
  if(action==='signed_update'){
   const r=await sendSignedUpdate(String(body.version_id||''),false);
   if(r.error&&r.status)return json({error:r.error},r.status);
   return json(r);
  }
  if(action==='link'){
   const value=token();const version=await rpc('link',{version_id:body.version_id,signer_id:body.signer_id,hash:await tokenHash(value)});const signer=version.recipients.find((s:any)=>s.id===body.signer_id);
   return json({version,links:[{signer_id:signer.id,name:signer.name,email:signer.email,url:link(value,signer.role),...(body.send_email===true?await mailLink(version,signer,value):{})}]});
  }
  if(['list','draft','save','void','revoke_link'].includes(action))return json(await rpc(action,{...body,actor:'Venue staff'}));
  return json({error:'Unknown agreement action.'},400);
 }catch(e){console.error('venue-agreements',e instanceof Error?e.message:'Request failed');return json({error:e instanceof Error?e.message:'Contract request failed.'},400);}
});

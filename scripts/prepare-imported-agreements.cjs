// Server-only, opt-in preparation. Never issues agreements or sends messages.
const fs=require('node:fs'),vm=require('node:vm'),esbuild=require('esbuild');
if(!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.VITE_SUPABASE_URL)throw new Error('Load server-only Supabase environment variables.');
const mod={exports:{}};
const code=esbuild.buildSync({stdin:{contents:"export {buildVenueClient,venueDateKey} from './src/venue-clients.jsx'; export {prepareAgreementDraft} from './src/venue-contracts.jsx';",resolveDir:process.cwd(),loader:'js'},bundle:true,write:false,format:'cjs'}).outputFiles[0].text;
vm.runInNewContext(code,{module:mod,exports:mod.exports,Intl,Date});
async function rest(path,body){const key=process.env.SUPABASE_SERVICE_ROLE_KEY;const r=await fetch(process.env.VITE_SUPABASE_URL+'/rest/v1/'+path,{method:body?'POST':'GET',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw new Error(data.message||'Contract preparation failed');return data;}
(async()=>{
 const rows=await rest('nsh_form_responses?form_id=in.(a3a383f7-e1db-4344-9dec-ea879ad3406d,668f27d4-7e2d-4ce6-ba0c-bac5ddf9d8f8)&select=*&order=id.asc&limit=1000');
 if(rows.length===1000)throw new Error('Page all client records before preparing agreements.');
 const events=await rest('venue_inquiries?select=id,name,event_type,event_date,prebooking_form_response_id&prebooking_form_response_id=not.is.null');
 const today=mod.exports.venueDateKey();let created=0,existing=0,eligible=0;const log=[];
 for(const row of rows){if(!row.answers?.__honeybook)continue;const client=mod.exports.buildVenueClient(row,events.find(e=>e.prebooking_form_response_id===row.id),today);if(client.eventEnd&&client.eventEnd<today)continue;eligible++;
  const versions=await rest('rpc/venue_agreement_action',{p_action:'list',p_data:{response_id:row.id}});if(versions.length){existing++;continue;}
  if(process.argv.includes('--apply')){const v=await rest('rpc/venue_agreement_action',{p_action:'draft',p_data:{response_id:row.id,...mod.exports.prepareAgreementDraft(client),actor:'Portal setup'}});if(v.status!=='draft')throw new Error('Expected only a draft');created++;log.push({response_id:row.id,version_id:v.id,status:v.status});}
 }
 fs.mkdirSync('tmp',{recursive:true});fs.writeFileSync('tmp/agreement-preparation.json',JSON.stringify(log,null,2));console.log(JSON.stringify({mode:process.argv.includes('--apply')?'apply':'preview',eligible,existing,created,emailsSent:0,agreementsIssued:0}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});

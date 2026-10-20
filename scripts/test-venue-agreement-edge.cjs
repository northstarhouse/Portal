const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),esbuild=require('esbuild'),crypto=require('node:crypto');
const aliases={'npm:pdf-lib@1.17.1':require.resolve('pdf-lib'),'npm:@pdf-lib/fontkit@1.1.1':require.resolve('@pdf-lib/fontkit')};
const code=esbuild.buildSync({entryPoints:['supabase/functions/venue-agreements/index.ts'],bundle:true,platform:'node',format:'cjs',write:false,alias:aliases}).outputFiles[0].text;
function handler(fetch){let serve;const context={console:{error(){}},require,Buffer,TextEncoder,TextDecoder,Uint8Array,Uint32Array,ArrayBuffer,Date,Promise,Response,Request,crypto:crypto.webcrypto,fetch,Deno:{env:{get:name=>({SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_ROLE_KEY:'test-service-secret',RESEND_API_KEY:'test-email-secret'})[name]},serve:fn=>{serve=fn;}},module:{exports:{}}};vm.runInNewContext(code,context);return serve;}
const req=(body,headers={})=>new Request('https://edge.example',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
test('no staff records without a valid existing portal session',async()=>{
 let calls=0;const api=handler(async()=>{calls++;return Response.json(false);});
 assert.equal((await api(req({action:'list',response_id:'someone'}))).status,403);assert.equal(calls,0);
 assert.equal((await api(req({action:'summary'},{'x-app-token':'expired'}))).status,403);assert.equal(calls,1);
 assert.equal((await api(req({action:'view',token:'guess'}))).status,401);assert.equal(calls,1);
});
test('recipient view strips private email addresses and signature verification evidence',async()=>{
 const record={id:'version',title:'Test agreement',signers:[{name:'Client',email:'client@example.invalid',role:'client'}],recipients:[{id:'s',name:'Client',email:'client@example.invalid',role:'client',status:'pending',token_hash:'private',evidence:{ip:'private-ip'}}],events:[{action:'viewed',actor:'Client',detail:{private:'private-detail'}}]};
 const api=handler(async(url,options)=>{const action=JSON.parse(options.body).p_action;return Response.json(action==='resolve'?{signer:{id:'s',email:'client@example.invalid'},version:record}:{signer:{id:'s',name:'Client',email:'client@example.invalid',role:'client',status:'pending'},version:record,can_sign:true});});
 const response=await api(req({action:'view',token:'a'.repeat(64)}));const body=await response.text();assert.equal(response.status,200);assert.ok(!body.includes('client@example.invalid'));assert.ok(!body.includes('private-ip'));assert.ok(!body.includes('private-detail'));assert.ok(!body.includes('token_hash'));
});
test('email verification codes go only to the named recipient, never a BCC',async()=>{
 let mail;const api=handler(async(url,options)=>{const data=JSON.parse(options.body);if(url.includes('resend.com')){mail=data;return Response.json({id:'sent'});}return Response.json(data.p_action==='resolve'?{signer:{id:'s',email:'client@example.invalid',status:'pending'}}:{});});
 const response=await api(req({action:'request_code',token:'a'.repeat(64)}));assert.equal(response.status,200);assert.deepEqual(mail.to,['client@example.invalid']);assert.equal(mail.bcc,undefined);assert.match(mail.text,/\b\d{6}\b/);const body=await response.json();assert.ok(!JSON.stringify(body).includes(mail.text.match(/\b\d{6}\b/)[0]));
});
test('issuing without email requested creates individual links without sending messages',async()=>{
 let emails=0;const spec=[{name:'Client',email:'client@example.invalid',role:'client'},{name:'Venue',email:'venue@example.invalid',role:'venue'}];
 const api=handler(async(url,options)=>{const data=JSON.parse(options.body);if(url.includes('resend.com')){emails++;return Response.json({});}if(url.endsWith('has_valid_app_session'))return Response.json(true);if(url.endsWith('venue_agreement_record'))return Response.json({signers:spec});return Response.json({id:'version',recipients:spec.map((s,i)=>({...s,id:String(i)}))});});
 const response=await api(req({action:'issue',version_id:'v',send_email:false},{'x-app-token':'staff-session'}));const data=await response.json();assert.equal(response.status,200);assert.equal(emails,0);assert.equal(data.links.length,2);assert.notEqual(data.links[0].url,data.links[1].url);assert.match(data.links[0].url,/#agreement=[a-f0-9]{64}$/);
});

test('recorded client signatures reject further signing, decline and code requests',async()=>{
 for(const action of ['sign','decline','request_code']){
  let calls=0;
  const api=handler(async(url,options)=>{
   calls++;assert.ok(url.endsWith('venue_agreement_action'));
   assert.equal(JSON.parse(options.body).p_action,'resolve');
   return Response.json({signer:{id:'signed-client',role:'client',status:'signed',email:'client@example.invalid'},version:{status:'pending'}});
  });
  const response=await api(req({action,token:'a'.repeat(64),code:'123456',signed_name:'Changed signature',consent:true,reason:'Change'}));
  assert.equal(response.status,409);assert.match((await response.json()).error,/locked/i);assert.equal(calls,1);
 }
});

test('signed client page is read-only even if an old response advertises can_sign',()=>{
 const uiCode=esbuild.buildSync({entryPoints:['src/venue-contracts.jsx'],bundle:true,format:'cjs',write:false}).outputFiles[0].text;
 const signer={id:'s',name:'Client',signed_name:'Client',status:'signed',role:'client',signed_at:'2026-10-19T20:00:00Z'};
 const data={can_sign:true,signer,version:{title:'Agreement',version:1,status:'pending',body:'Contract text',recipients:[signer],events:[]}};
 let stateIndex=0;const mod={exports:{}};
 const React={createElement:(type,props,...children)=>({type,props:props||{},children}),useEffect(){},useState:initial=>[stateIndex++===0?data:initial,()=>{}]};
 vm.runInNewContext(uiCode,{module:mod,exports:mod.exports,React});
 const tree=mod.exports.AgreementSigningPage({api:async()=>{},token:'test'});
 const nodes=[];function visit(node){if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(visit);return;}nodes.push(node);node.children?.forEach(visit);}visit(tree);
 assert.equal(nodes.filter(n=>['input','textarea'].includes(n.type)).length,0);
 assert.ok(nodes.some(n=>n.type==='button'&&n.children.includes('Download a copy')));
 const record=mod.exports.RecordedSignature({signer});assert.equal(record.props['aria-label'],'Locked signature record');
});
test('agreement PDF supports Unicode, page breaks and a signature audit appendix',async()=>{
 const pdfCode=esbuild.buildSync({entryPoints:['supabase/functions/venue-agreements/pdf.ts'],bundle:true,platform:'node',format:'cjs',write:false,alias:aliases}).outputFiles[0].text;
 const mod={exports:{}};vm.runInNewContext(pdfCode,{module:mod,exports:mod.exports,require,Buffer,fetch:async()=>new Response(fs.readFileSync('assets/fonts/NotoSans.ttf')),setTimeout,clearTimeout,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer});
 const version={id:'test-document',title:'Test agreement — café',version:1,status:'completed',document_hash:'a'.repeat(64),body:Array.from({length:90},(_,i)=>`Section ${i+1}. Test event rental terms, privacy, setup and departure. Café, résumé, Кириллица. Each line must remain readable.`).join('\n'),recipients:[{name:'Test Client',email:'client@example.invalid',role:'client',status:'signed',signed_name:'Test Client',signed_at:'2026-10-19T20:00:00Z',consent:'I have read this agreement and agree to sign electronically.',evidence:{document_hash:'a'.repeat(64),email_verified_at:'2026-10-19T20:00:00Z'}}],events:[{created_at:'2026-10-19T20:00:00Z',action:'signed',actor:'Test Client',detail:{}}]};
 const bytes=await mod.exports.agreementPdf(version);const {PDFDocument}=require('pdf-lib');const reopened=await PDFDocument.load(bytes);assert.ok(reopened.getPageCount()>=3);assert.equal(reopened.getTitle(),version.title);fs.mkdirSync('tmp/pdfs',{recursive:true});fs.writeFileSync('tmp/pdfs/agreement-test.pdf',bytes);
});

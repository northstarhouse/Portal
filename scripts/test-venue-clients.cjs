const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const esbuild = require('esbuild');
const code = esbuild.transformSync(fs.readFileSync('src/venue-clients.jsx', 'utf8'), {loader:'jsx',format:'cjs'}).code;
const mod={exports:{}};
vm.runInNewContext(code,{module:mod,exports:mod.exports,Intl,Date});
const {buildVenueClient,venueDateKey}=mod.exports;
test('deployed browser artifact contains the dashboard without an unresolved module import',()=>{
  const artifact=fs.readFileSync('assets/app.js','utf8');
  assert.match(artifact,/vc-dashboard/);
  assert.match(artifact,/Needs your attention/);
  assert.doesNotMatch(artifact,/\brequire\(["']\.\/venue-clients/);
});
const today='2026-10-19';
function submission(overrides={}){
  return {id:'one',form_id:'a3a383f7-e1db-4344-9dec-ea879ad3406d',answers:{__honeybook:{project:{id:'project',name:'Casey & Morgan Wedding',project_date:'2026-11-07'},workspace:{id:'workspace'},files:[{id:'new',updated_at:'2026-10-18'},{id:'old',updated_at:'2026-09-01'}],file_responses:[{id:'new',responses:{payments:{total:{amount:650000,currency:'usd'},amount_paid:{amount:570000,currency:'usd'},balance_due:{amount:80000,currency:'usd'},schedule:[{amount:{amount:570000,currency:'usd'},due_date:'2026-09-01',paid:true},{amount:{amount:80000,currency:'usd'},due_date:'2026-10-07',paid:false}]},signatures:{all_required_signed:false,signatures:[{signee_name:'Casey',signee_type:'client',required:true,signed:true},{signee_name:'Venue',signee_type:'vendor',required:true,signed:false}]}}},{id:'old',responses:{signatures:{all_required_signed:true,signatures:[{signee_name:'Casey',required:true,signed:true}]}}}],...overrides}}};
}
test('uses original money units and the latest invoice contract, not an older signed agreement',()=>{
  const c=buildVenueClient(submission(),null,today);
  assert.equal(c.paid,570000);assert.equal(c.balance,80000);assert.equal(c.unsigned.length,1);assert.equal(c.unsigned[0].signee_type,'vendor');
  assert.equal(c.tasks[0].kind,'payment');assert.equal(c.tasks[0].overdue,true);assert.match(c.tasks[0].title,/800\.00/);
  assert.equal(c.tasks.filter(t=>t.kind==='payment').length,1);
});
test('never calls unverified insurance supplied or missing',()=>{
  const c=buildVenueClient(submission(),null,today);
  assert.equal(c.insuranceVerified,false);assert.equal(c.tasks.find(t=>t.kind==='insurance').title,'Confirm insurance on file');
  const verified=buildVenueClient(submission(),{insurance_uploaded_at:'2026-10-01'},today);
  assert.equal(verified.tasks.some(t=>t.kind==='insurance'),false);
});
test('uses a 30-calendar-day final-detail deadline across DST',()=>{
  const c=buildVenueClient(submission({project:{name:'Wedding',project_date:'2026-11-07'}}),null,today);
  assert.equal(c.requirementsDue,'2026-10-08');assert.equal(c.days,19);
  assert.equal(venueDateKey(new Date('2026-10-20T01:00:00Z')),'2026-10-19');
});
test('does not mark a blank optional survey complete; accepts actual submitted requirements',()=>{
  const s=submission();s.answers.__honeybook.file_responses.push({id:'q',title:'Wedding Info Questionnaire',responses:{questionnaire:{questions:[{required:false,answered:false}]}}});
  assert.equal(buildVenueClient(s,null,today).surveyComplete,false);
  s.answers.__honeybook.file_responses[2].responses.questionnaire.questions[0].answered=true;
  assert.equal(buildVenueClient(s,null,today).surveyComplete,true);
  assert.equal(buildVenueClient(submission(),{questionnaire_form_response_id:'survey'},today).surveyComplete,true);
});
test('future planning does not become urgent months before it is needed',()=>{
  const s=submission({project:{name:'Wedding',project_date:'2027-10-19'},file_responses:[]});
  const c=buildVenueClient(s,null,today);
  assert.equal(c.urgent.length,0);assert.equal(c.tasks.length,2);assert.equal(c.tasks[0].due,'2027-09-19');
});
test('native pre-booking retains unknown finances and the correct event type',()=>{
  const c=buildVenueClient({id:'native',form_id:'a3a383f7-e1db-4344-9dec-ea879ad3406d',answers:{'7fnabd0i':'Casey',sn9urgfr:'2027-05-01'}},null,today);
  assert.equal(c.type,'Wedding');assert.equal(c.total,null);assert.equal(c.payments,null);assert.ok(c.tasks.some(t=>t.kind==='booking'));
});
test('preserves a multi-day event end rather than hiding an ongoing event',()=>{
  const c=buildVenueClient(submission({project:{name:'Rehearsal & Wedding',project_date:'2026-10-18',project_end_date:'2026-10-20'}}),null,today);
  assert.equal(c.eventEnd,'2026-10-20');assert.equal(c.days,-1);
});
const source=fs.readFileSync('src/app.jsx','utf8');
const loader=source.slice(source.indexOf('function fetchVenueInquiries('),source.indexOf('function loadVenueClientEvents('));
test('loads beyond 200 responses so View all really includes every client',async()=>{
  const offsets=[];const context={SUPABASE_URL:'https://example.test',SUPABASE_KEY:'test',RENTAL_INQUIRY_FORM_IDS:['form'],fetch:async url=>{
    if(url.includes('/nsh_forms?'))return Response.json([{id:'form',title:'Pre Booking',fields:[]}]);
    const offset=Number(new URL(url).searchParams.get('offset'));offsets.push(offset);
    return Response.json(Array.from({length:offset===0?200:1},(_,i)=>({id:String(offset+i),form_id:'form',answers:{}})));
  }};vm.runInNewContext(loader,context);const rows=await context.fetchVenueInquiries({strict:true});assert.equal(rows.length,201);assert.deepEqual(offsets,[0,200]);
});
test('failed data reads surface an error instead of a false empty dashboard',async()=>{
  const context={SUPABASE_URL:'https://example.test',SUPABASE_KEY:'test',RENTAL_INQUIRY_FORM_IDS:['form'],fetch:async()=>new Response('unavailable',{status:503})};
  vm.runInNewContext(loader,context);await assert.rejects(context.fetchVenueInquiries({strict:true}),/Could not load/);
});

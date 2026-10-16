const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const esbuild = require('esbuild');

const source = fs.readFileSync('supabase/functions/process-venue-pipeline/index.ts', 'utf8');
const code = esbuild.transformSync(source, { loader: 'ts', format: 'cjs' }).code;

async function runPipeline(pending, checkFails = false) {
  let handler;
  const sent = [], patched = [];
  const context = {
    console: { error() {} }, Response, Date,
    Deno: { env: { get: key => key === 'SUPABASE_URL' ? 'https://database.example' : 'test-only' }, serve: fn => { handler = fn; } },
    fetch: async (url, options = {}) => {
      if (url.includes('/functions/v1/send-email')) {
        sent.push(JSON.parse(options.body));
        return Response.json({ success: true });
      }
      const query = new URL(url).searchParams;
      const table = new URL(url).pathname.split('/').pop();
      if (options.method === 'PATCH') {
        patched.push(JSON.parse(options.body));
        return new Response(null, { status: 204 });
      }
      if (table === 'venue_email_templates') return Response.json(
        ['initial_inquiry', 'follow_up_48h', 'final_follow_up_30d'].map(key => ({ key, subject: key, body: 'Hello {{name}}' }))
      );
      if (table === 'estate_tours') {
        assert.equal(query.get('status'), 'eq.requested');
        assert.equal(query.get('visitor_email'), 'ilike.client@example.com');
        return checkFails ? new Response('unavailable', { status: 503 }) : Response.json(pending ? [{ id: 'request' }] : []);
      }
      if (table === 'venue_inquiries' && [
        'eq.New', 'eq.Initial Inquiry Sent', 'in.("Initial Inquiry Sent","Follow Up Sent")', 'eq.Final Follow Up Sent'
      ].includes(query.get('status'))) return Response.json([{ id: 1, name: 'Client', email: ' Client@Example.com ' }]);
      return Response.json([]);
    },
  };
  vm.runInNewContext(code, context);
  const response = await handler(new Request('https://example.com', { method: 'GET' }));
  return { result: await response.json(), sent, patched };
}

test('pending alternate times block initial, 48h, 30d outreach and auto-archive', async () => {
  const { sent, patched, result } = await runPipeline(true);
  assert.equal(sent.length, 0);
  assert.equal(patched.length, 0);
  assert.equal(result.errors, 0);
});

test('unrelated clients retain the existing outreach and archival flow', async () => {
  const { sent, patched, result } = await runPipeline(false);
  assert.equal(sent.length, 3);
  assert.equal(patched.length, 4);
  assert.equal(result.archived, 1);
});

test('request lookup failures prevent outreach instead of assuming no request', async () => {
  const { sent, patched, result } = await runPipeline(false, true);
  assert.equal(sent.length, 0);
  assert.equal(patched.length, 0);
  assert.equal(result.errors, 4);
});

test('both Portal follow-up composers recheck pending requests before sending', async () => {
  const app = fs.readFileSync('src/app.jsx', 'utf8');
  const allowed = app.slice(app.indexOf('function inquiryFollowUpAllowed('), app.indexOf('// Best guess at'));
  const context = { inquiryPreviewFields: r => ({ email: r.email }) };
  vm.runInNewContext(allowed, context);
  assert.equal(context.inquiryFollowUpAllowed({ email: ' CLIENT@example.com ' }, ['client@example.com']), false);
  assert.equal(context.inquiryFollowUpAllowed({ answers: { w_email: 'CLIENT@example.com' } }, ['client@example.com']), false);
  assert.equal(context.inquiryFollowUpAllowed({ email: 'other@example.com' }, []), true);
  assert.equal(context.inquiryFollowUpAllowed({ email: 'other@example.com' }, null), false);
  const starts = [...app.matchAll(/async function sendFollowUp\(r\) \{/g)];
  assert.equal(starts.length, 2);
  for (const start of starts) {
    const fn = app.slice(start.index, app.indexOf('\n  }', start.index) + 4);
    let sends = 0, closed = false;
    const sandbox = {
      fetchPendingTourRequestEmails: async () => ['client@example.com'],
      setPendingTourEmails() {}, inquiryFollowUpAllowed: context.inquiryFollowUpAllowed,
      setComposingId: () => { closed = true; }, alert() {},
      buildFollowUpEmail: () => { sends++; throw new Error('Must not build or send'); },
    };
    vm.runInNewContext(fn, sandbox);
    await sandbox.sendFollowUp({ email: 'client@example.com' });
    assert.equal(sends, 0);
    assert.equal(closed, true);
  }
});

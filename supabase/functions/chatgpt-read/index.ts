// Read-only data for ChatGPT (a custom GPT "action"). GET only; every request needs the key in the x-api-key header
// (the CHATGPT_READ_KEY secret). Four datasets: /bookings, /events, /financials, /board.
// The same four datasets are also offered to Claude as an MCP server at /mcp (the connector sends the CLAUDE_MCP_KEY secret in an
// x-api-key request header). Same data, same privacy rules, read-only.
// The /mcp and REST routes never write. Only /mcp-rw (its own key, CLAUDE_WRITE_KEY) can make a few narrow changes: add an
// event task update, mark a task done, log an event expense, add a board item, record a booking payment. Never deletes.
// Personal details are never returned: no client or donor names, emails, phone numbers,
// addresses, notes, receipts or individual board votes. Bookings are identified by venue code (the event date), not by name.
import { orderLinesFor, venueCode, weekdayOf, isLaterAddOnRow } from "./invoice-lines.ts";

const SB = Deno.env.get("SUPABASE_URL")!, SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, API_KEY = Deno.env.get("CHATGPT_READ_KEY") || "";
const WEDDING = "a3a383f7-e1db-4344-9dec-ea879ad3406d", EVENT = "668f27d4-7e2d-4ce6-ba0c-bac5ddf9d8f8";
const LEGACY_BEFORE = "2026-10-30"; // bookings made before the Portal's own agreements count as signed

const same = (a: string, b: string) => { if (!a || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

async function rest(path: string) {
  const r = await fetch(`${SB}/rest/v1/${path}`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
  if (!r.ok) throw new Error(`data request failed (${r.status})`);
  return r.json();
}
async function restAll(path: string) {
  const out: any[] = [];
  for (let off = 0; off < 20000; off += 1000) {
    const rows = await rest(`${path}${path.includes("?") ? "&" : "?"}limit=1000&offset=${off}`);
    if (!Array.isArray(rows)) break;
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}
const dollars = (cents: number) => Math.round(cents || 0) / 100;
const num = (v: unknown) => parseFloat(String(v ?? "0")) || 0;
const isZeroPrice = (t: unknown) => /^\s*\$?\s*0+(?:\.0+)?\s*$/.test(String(t == null ? "" : t));
const priceText = (t: unknown) => (t == null || String(t).trim() === "" ? null : isZeroPrice(t) ? "Free" : String(t));
const enc = encodeURIComponent;

// ---------------------------------------------------------------- /bookings
async function bookingRecords() {
  const [subs, inqs, sched, vers] = await Promise.all([
    restAll(`nsh_form_responses?select=id,form_id,created_at,answers&form_id=in.(${WEDDING},${EVENT})&order=created_at.asc`),
    restAll("venue_inquiries?select=id,event_date,event_type,prebooking_form_response_id,brick_lines&prebooking_form_response_id=not.is.null"),
    restAll("venue_payment_schedule?select=inquiry_id,sequence,kind,label,amount_cents,amount_paid_cents,due_date,status&order=sequence.asc"),
    restAll("venue_agreement_versions?select=response_id,status"),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const out: any[] = [];
  for (const sub of subs) {
    const a = sub.answers || {};
    if (/\+test@thenorthstarhouse\.org/i.test(JSON.stringify(a))) continue;
    const hb = a.__honeybook, inq = inqs.find((q: any) => q.prebooking_form_response_id === sub.id) || null;
    const date = String(inq?.event_date || hb?.project?.project_date || a.sn9urgfr || a.evp_date || "").slice(0, 10);
    const files: any[] = hb?.files || [];
    const stamp = (id: string) => files.find((x) => x.id === id)?.updated_at || "";
    const invoice = (hb?.file_responses || []).filter((r: any) => r.responses?.payments && typeof r.responses.payments === "object").sort((x: any, y: any) => String(stamp(y.id)).localeCompare(String(stamp(x.id))))[0];
    const P = invoice?.responses?.payments || null;
    const eventType = a.__event_type ? String(a.__event_type) : /wedding/i.test(String(hb?.project?.name || inq?.event_type || "")) || sub.form_id === WEDDING ? "Wedding" : (String(inq?.event_type || "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (c: string) => c.toUpperCase()) || "Private Event");
    const rows = !P && inq ? sched.filter((r: any) => r.inquiry_id === inq.id) : [];
    if (!P && !rows.length) continue; // no invoice or payment schedule on record
    const nativeRows = !P ? rows.filter((r: any) => !isLaterAddOnRow(r)) : null;
    // payments
    let schedule: { label: string; due: string | null; cents: number; paid: boolean; deposit: boolean }[] = [];
    let total = 0, paid = 0;
    if (P) {
      const raw: any[] = P.schedule || [];
      schedule = raw.map((p, i) => {
        const cents = p.amount?.amount || 0;
        const dep = /security deposit/i.test(p.__nativeLabel || "") || (!p.__nativeLabel && raw.length > 1 && i === raw.length - 1 && cents === 80000);
        return { label: p.__nativeLabel || (dep ? "Security Deposit (refundable)" : i === 0 ? "Booking payment" : "Scheduled payment " + (i + 1)), due: p.due_date ? String(p.due_date).slice(0, 10) : null, cents, paid: !!p.paid, deposit: dep };
      });
      total = P.total?.amount ?? 0; paid = P.amount_paid?.amount || 0;
    } else if (nativeRows) {
      schedule = nativeRows.map((r: any) => ({ label: r.label || "Payment", due: r.due_date ? String(r.due_date).slice(0, 10) : null, cents: r.amount_cents || 0, paid: r.status === "paid", deposit: /security/i.test(String(r.kind || "") + " " + String(r.label || "")) }));
      total = nativeRows.reduce((t: number, r: any) => t + (r.amount_cents || 0), 0); paid = nativeRows.reduce((t: number, r: any) => t + (r.amount_paid_cents || 0), 0);
    }
    const manual = (Array.isArray(a.__venue_checklist?.manual_payments) ? a.__venue_checklist.manual_payments : []).filter((m: any) => m?.cents > 0);
    let left = manual.reduce((t: number, m: any) => t + m.cents, 0);
    paid += left;
    schedule.sort((x, y) => (x.deposit ? 1 : 0) - (y.deposit ? 1 : 0) || String(x.due || "9999").localeCompare(String(y.due || "9999")));
    for (const p of schedule) if (!p.paid && p.cents > 0 && left >= p.cents) { left -= p.cents; p.paid = true; }
    // what was ordered
    const savedOrder = a.__venue_checklist?.order && Array.isArray(a.__venue_checklist.order.items) && a.__venue_checklist.order.items.length ? a.__venue_checklist.order : null;
    const lines = orderLinesFor({ order: savedOrder, honeybook: P, nativeRows, eventDate: date, eventType, brickLines: Array.isArray(inq?.brick_lines) ? inq.brick_lines : [], timeOnSite: a.__venue_checklist?.time_on_site || null });
    if (savedOrder || !P) total = lines.reduce((t, l) => t + l.amount, 0);
    // shown only once the client has signed or paid something (as in the Portal's own list)
    const nativeVersions = vers.filter((v: any) => v.response_id === sub.id && !["draft", "void"].includes(v.status));
    const legacy = !nativeVersions.length && String(sub.created_at || "").slice(0, 10) < LEGACY_BEFORE;
    const signed = legacy || nativeVersions.some((v: any) => v.status === "completed");
    if (!signed && paid <= 0) continue;
    const unpaid = schedule.filter((p) => !p.paid && p.cents > 0);
    const next = unpaid[0] || null;
    out.push({
      booking: [venueCode(date), eventType].filter(Boolean).join(" · ") || "Booking",
      venue_code: venueCode(date) || null,
      event_type: eventType,
      event_date: date || null,
      weekday: weekdayOf(date) || null,
      upcoming: !!date && date >= today,
      payment_status: total > 0 && paid >= total ? "Paid in full" : paid > 0 ? "Partially paid" : "Unpaid",
      past_due: signed && unpaid.some((p) => p.due && p.due < today),
      invoice_total: dollars(total), paid_so_far: dollars(paid), balance_due: dollars(Math.max(0, total - paid)),
      next_payment: next ? { due: next.due, amount: dollars(next.cents), what: next.label } : null,
      items_ordered: lines.map((l) => ({ item: l.item, description: l.desc || null, quantity: l.qty, unit_price: dollars(l.unit), amount: dollars(l.amount) })),
      payment_schedule: schedule.map((p) => ({ what: p.label, due: p.due, amount: dollars(p.cents), paid: p.paid })),
      _id: sub.id, _form_id: sub.form_id, _balance_cents: Math.max(0, total - paid),
    });
  }
  out.sort((x, y) => String(x.event_date || "9999").localeCompare(String(y.event_date || "9999")));
  return out;
}
async function bookings() {
  const pub = (await bookingRecords()).map(({ _id, _form_id, _balance_cents, ...r }: any) => r);
  return { count: pub.length, note: "Amounts are in dollars. The security deposit is refundable and is included in the invoice total. Clients are identified by venue code (the event date), not by name.", bookings: pub };
}

// ---------------------------------------------------------------- /events
async function events() {
  const [plan, committee, budget, earnings, orders] = await Promise.all([
    restAll("events_plan?select=name,year,date,start_time,end_time,pricing,budget,decisions,final_decision,multi_day,days&year=eq.2027&order=sort_order.asc"),
    restAll("events_committee?select=name,date,start_time,end_time,status,purpose,description,expected_attendance,pricing,ticket_tiers,checklist,hidden&order=date.asc.nullslast"),
    restAll("Op%20Budget?select=event_name,description,amount,type,date,status&event_name=not.is.null&order=date.asc"),
    restAll("Op%20Earnings?select=event,earning_source,amount,date&event=not.is.null&order=date.asc"),
    restAll("ticket_orders?select=event_title,quantity,amount,net_amount,kind,status&kind=eq.paid&status=eq.completed"),
  ]);
  const key = (n: unknown) => String(n || "").toLowerCase().replace(/\s+/g, " ").trim();
  const fin: Record<string, any> = {};
  const slot = (name: string) => (fin[key(name)] ||= { event: name, expenses: [], expenses_total: 0, other_earnings: [], other_earnings_total: 0, tickets_sold: 0, ticket_sales_gross: 0, ticket_sales_net: 0 });
  budget.forEach((b: any) => {
    const s = slot(b.event_name), amt = num(b.amount);
    const m = String(b.description || "").match(/\((\d+(?:\.\d+)?)% of ticket sales\)/);
    s.expenses.push({ description: b.description, amount: amt, type: b.type, date: b.date, ...(m ? { split_percent_of_ticket_sales: parseFloat(m[1]) } : {}) });
    if (b.type === "Purchase" || b.type === "In-Kind") s.expenses_total += amt;
  });
  earnings.forEach((e: any) => { const s = slot(e.event), amt = num(e.amount); s.other_earnings.push({ source: e.earning_source, amount: amt, date: e.date }); s.other_earnings_total += amt; });
  orders.forEach((o: any) => { const s = slot(o.event_title); s.tickets_sold += num(o.quantity); s.ticket_sales_gross += num(o.amount); s.ticket_sales_net += num(o.net_amount); });
  const round = (n: number) => Math.round(n * 100) / 100;
  const finances = Object.values(fin).map((s: any) => ({ ...s, expenses_total: round(s.expenses_total), other_earnings_total: round(s.other_earnings_total), ticket_sales_gross: round(s.ticket_sales_gross), ticket_sales_net: round(s.ticket_sales_net), net: round(s.other_earnings_total + s.ticket_sales_net - s.expenses_total) }));
  return {
    note: "Amounts are in dollars. net = other earnings + ticket sales (after fees) minus expenses. Match events across lists by name.",
    event_plan_2027: plan.map((p: any) => ({ name: p.name, decision: p.final_decision || "No decision yet", date: p.multi_day ? (Array.isArray(p.days) ? p.days.map((d: any) => d.date).filter(Boolean) : []) : p.date, start_time: p.start_time, end_time: p.end_time, pricing: priceText(p.pricing), budget: p.budget || null, committee_decisions: p.decisions || null })),
    committee_events: committee.filter((c: any) => !c.hidden).map((c: any) => ({ name: c.name, date: c.date, start_time: c.start_time, end_time: c.end_time, status: c.status, type: c.purpose || null, description: c.description || null, expected_attendance: c.expected_attendance || null, pricing: priceText(c.pricing), ticket_tiers: (Array.isArray(c.ticket_tiers) ? c.ticket_tiers : []).map((t: any) => ({ name: t.name, price: num(t.price) > 0 ? num(t.price) : "Free", limit: t.limit || null })), checklist: (Array.isArray(c.checklist) ? c.checklist : []).map((t: any) => ({ task_id: t.id, task: t.text, done: !!t.done, due: t.due || null, updates: (Array.isArray(t.updates) ? t.updates : []).map((u: any) => ({ at: u.at, text: u.text })) })) })),
    event_finances: finances,
  };
}

// ---------------------------------------------------------------- /financials
async function financials() {
  const [budget, earnings, cash, donations, sponsors, inkind] = await Promise.all([
    restAll("Op%20Budget?select=area,type,amount,date,description,event_name,status&order=date.desc"),
    restAll("Op%20Earnings?select=area,event,earning_source,amount,date&order=date.desc"),
    restAll("Cash%20Log?select=description,amount,date,direction&order=date.desc"),
    restAll("donations?select=amount,date,type"),
    restAll("Sponsors?select=id,%22Business%20Name%22,Donation,%22Fair%20Market%20Value%22,%22Area%20Supported%22,%22Date%20Recieved%22,sponsor_status"),
    restAll("Sponsor%20In-Kind?select=sponsor_id,description,date,value,contribution_type"),
  ]);
  const byMonth: Record<string, { month: string; type: string; gifts: number; total: number }> = {};
  donations.forEach((d: any) => {
    const month = String(d.date || "").slice(0, 7) || "unknown", type = d.type || "Other", k = month + "|" + type;
    const e = (byMonth[k] ||= { month, type, gifts: 0, total: 0 });
    e.gifts += 1; e.total += num(d.amount);
  });
  const nameOf: Record<string, string> = {}; sponsors.forEach((s: any) => { nameOf[s.id] = s["Business Name"]; });
  return {
    note: "Amounts are in dollars. Donations are summed by month and type with no donor names. Sponsors are businesses.",
    operating_budget_spending: budget.map((b: any) => ({ area: b.area, type: b.type, amount: num(b.amount), date: b.date, description: b.description, event: b.event_name, status: b.status })),
    earnings: earnings.map((e: any) => ({ area: e.area, event: e.event, source: e.earning_source, amount: num(e.amount), date: e.date })),
    cash_log: cash.map((c: any) => ({ description: c.description, amount: num(c.amount), date: c.date, direction: c.direction })),
    donations_by_month_and_type: Object.values(byMonth).map((e) => ({ ...e, total: Math.round(e.total * 100) / 100 })).sort((x, y) => y.month.localeCompare(x.month)),
    sponsors: sponsors.map((s: any) => ({ business: s["Business Name"], status: s.sponsor_status, donation: s.Donation, fair_market_value: s["Fair Market Value"], area_supported: s["Area Supported"], received: s["Date Recieved"] })),
    sponsor_in_kind: inkind.map((k: any) => ({ business: nameOf[k.sponsor_id] || null, description: k.description, date: k.date, value: num(k.value), kind: k.contribution_type })),
  };
}

// ---------------------------------------------------------------- /board
async function board() {
  const items = await restAll("Board%20Voting%20Items?select=title,item_type,status,meeting_date,due_date,decision,decision_detail,response_timing&order=row_id.desc");
  return {
    note: "Board Communication items. Individual votes, who submitted or voted, and the free-text descriptions are never included. Items from the minutes show their decision.",
    count: items.length,
    items: items.map((i: any) => ({ title: i.title, kind: i.item_type || "Vote", status: i.status, decision: i.decision || null, decision_note: i.decision_detail || null, meeting_date: i.meeting_date, due_date: i.due_date, response_needed: i.response_timing || null })),
  };
}

const routes: Record<string, () => Promise<unknown>> = { bookings, events, financials, board };

// ---------------------------------------------------------------- writes (only on /mcp-rw)
const WRITE_KEY = Deno.env.get("CLAUDE_WRITE_KEY") || "";
const MAX_CHANGES_PER_HOUR = 30;
const todayPT = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
const isDate = (d: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || "")) && !isNaN(Date.parse(String(d) + "T12:00:00Z"));
const oneLine = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const multiLine = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max);
class Refuse extends Error {}
const refuse = (m: string): never => { throw new Refuse(m); };

async function sbWrite(method: "POST" | "PATCH", path: string, body: unknown) {
  const r = await fetch(`${SB}/rest/v1/${path}`, { method, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(body) });
  const t = await r.text(); let j: any = null; try { j = t ? JSON.parse(t) : null; } catch (_e) { /* not JSON */ }
  if (!r.ok) throw new Error("write failed (" + r.status + ")");
  return j;
}
// Every change is written to the Activity Log (which also sends the staff phone notification).
async function audit(what: string, detail: Record<string, unknown>) {
  try { await sbWrite("POST", "activity_log", { action: "claude_change", description: "Claude: " + what, volunteer_name: "Claude", detail }); } catch (_e) { /* the change itself already went through */ }
}
async function brake() {
  const rows = await rest("activity_log?select=id&action=eq.claude_change&created_at=gte." + enc(new Date(Date.now() - 3600000).toISOString()));
  if (Array.isArray(rows) && rows.length >= MAX_CHANGES_PER_HOUR) refuse("Too many changes were made through Claude in the last hour (the limit is " + MAX_CHANGES_PER_HOUR + "). Wait a while, or ask staff to make this one.");
}
async function findEvent(name: unknown) {
  const want = oneLine(name, 200).toLowerCase();
  if (!want) refuse("Give the event name exactly as get_events lists it.");
  const rows = (await restAll("events_committee?select=id,name,checklist,updated_at")).filter((r: any) => String(r.name || "").trim().toLowerCase() === want);
  if (rows.length === 0) refuse(`There is no event named "${oneLine(name, 80)}". Use get_events for the exact names.`);
  if (rows.length > 1) refuse(`More than one event is named "${oneLine(name, 80)}", so I can't tell which one you mean.`);
  return rows[0];
}

async function changeTask(a: any, kind: "update" | "done") {
  await brake();
  const ev = await findEvent(a.event_name);
  const list: any[] = Array.isArray(ev.checklist) ? ev.checklist.map((t: any) => ({ ...t })) : [];
  const t = list.find((x) => x && String(x.id) === String(a.task_id));
  if (!t) refuse("That event has no task with that task_id. Use get_events to see each task's task_id.");
  const when = new Date().toISOString();
  let summary: string;
  if (kind === "update") {
    const text = oneLine(a.update, 500);
    if (!text) refuse("The update can't be empty.");
    if (t.done) refuse("That task is already done, so it can't take new updates.");
    t.updates = [...(Array.isArray(t.updates) ? t.updates : []), { text, at: when }];
    summary = `added an update to "${t.text}" (${ev.name})`;
  } else {
    if (t.done) return { changed: false, message: `"${t.text}" is already marked done.` };
    t.done = true;
    summary = `marked "${t.text}" done (${ev.name})`;
  }
  if (a.dry_run === true) return { dry_run: true, would: summary };
  const guard = ev.updated_at ? "updated_at=eq." + enc(ev.updated_at) : "updated_at=is.null";
  const rows = await sbWrite("PATCH", `events_committee?id=eq.${ev.id}&${guard}`, { checklist: list, updated_at: when });
  if (!Array.isArray(rows) || rows.length !== 1) refuse("Someone changed that event while this was being saved. Nothing was changed. Try again.");
  await audit(summary, { tool: kind === "update" ? "add_event_task_update" : "mark_event_task_done", event: ev.name, task_id: t.id });
  return { changed: true, message: summary };
}

async function addExpense(a: any) {
  await brake();
  const ev = await findEvent(a.event_name);
  const amount = Math.round(Number(a.amount) * 100) / 100;
  if (!(amount > 0) || amount > 10000) refuse("The amount must be more than $0 and no more than $10,000.");
  const description = oneLine(a.description, 200);
  if (!description) refuse("Say what the expense was for.");
  const date = a.date ? String(a.date) : todayPT();
  if (!isDate(date)) refuse("The date must look like 2026-11-19.");
  if (date > todayPT()) refuse("An expense can't be dated in the future.");
  const type = a.type === "In-Kind" ? "In-Kind" : "Purchase";
  const dup = await rest(`Op%20Budget?select=id&event_name=eq.${enc(ev.name)}&description=eq.${enc(description)}&amount=eq.${amount}&date=eq.${date}`);
  if (Array.isArray(dup) && dup.length) return { changed: false, message: "That exact expense is already recorded for this event." };
  const summary = `logged a $${amount.toFixed(2)} expense on ${ev.name}: ${description}`;
  if (a.dry_run === true) return { dry_run: true, would: summary };
  const rows = await sbWrite("POST", "Op%20Budget", { area: "Events", type, description, amount, date, event_name: ev.name, notes: "Added via Claude" });
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error("not saved");
  await audit(summary, { tool: "add_event_expense", event: ev.name, amount, date, type });
  return { changed: true, message: summary };
}

// Board meetings are the third Thursday of each month; the next one on or after today.
function nextBoardMeetingDate(): string | null {
  const now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let i = 0; i < 3; i++) {
    const first = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const d = new Date(first.getFullYear(), first.getMonth(), 1 + ((4 - first.getDay() + 7) % 7) + 14);
    if (d >= today) return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  return null;
}
async function addBoardItem(a: any) {
  await brake();
  const title = oneLine(a.title, 200);
  if (!title) refuse("Give the board item a title.");
  const kind = a.item_type ? String(a.item_type) : "Question";
  if (!["Question", "Discussion", "Update", "Vote"].includes(kind)) refuse("item_type must be Question, Discussion, Update or Vote.");
  const timing = a.response_timing ? String(a.response_timing) : "";
  if (timing && !["asap", "next_meeting", "date"].includes(timing)) refuse("response_timing must be asap, next_meeting or date.");
  let due: string | null = null;
  if (timing === "date") {
    if (!isDate(a.due_date) || String(a.due_date) < todayPT()) refuse("For a specific date, give due_date as YYYY-MM-DD (today or later).");
    due = String(a.due_date);
  } else if (timing === "next_meeting") due = nextBoardMeetingDate();
  const exists = (await restAll("Board%20Voting%20Items?select=title")).some((x: any) => String(x.title || "").trim().toLowerCase() === title.toLowerCase());
  if (exists) return { changed: false, message: "A board item with that exact title already exists." };
  const by = a.on_behalf_of ? oneLine(a.on_behalf_of, 80) + " (via Claude)" : "Staff (via Claude)";
  const summary = `opened a board ${kind.toLowerCase()}: ${title}`;
  if (a.dry_run === true) return { dry_run: true, would: summary, submitted_by: by, due_date: due };
  const row = { ...(kind !== "Vote" ? { item_type: kind } : {}), ...(timing ? { response_timing: timing } : {}), title, description: multiLine(a.description, 2000) || null, attachment_url: null, submitted_by: by, requested_by: null, due_date: due, meeting_date: nextBoardMeetingDate(), allow_notes_vote: false, status: "Open" };
  const rows = await sbWrite("POST", "Board%20Voting%20Items", row);
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error("not saved");
  await audit(summary, { tool: "add_board_item", title, kind });
  return { changed: true, message: summary };
}

async function recordPayment(a: any) {
  await brake();
  const code = oneLine(a.venue_code, 20).toUpperCase();
  if (!/^[A-Z]{3}-\d{2}-\d{4}$/.test(code)) refuse("venue_code must look like OCT-30-2026 (from get_venue_bookings).");
  let matches = (await bookingRecords()).filter((b: any) => b.venue_code === code);
  if (a.event_type) matches = matches.filter((b: any) => String(b.event_type).toLowerCase() === oneLine(a.event_type, 60).toLowerCase());
  if (matches.length === 0) refuse("No booking has that venue code" + (a.event_type ? " and event type" : "") + ".");
  if (matches.length > 1) refuse("More than one booking has that venue code. Add event_type to say which (" + matches.map((b: any) => b.event_type).join(" or ") + ").");
  const b: any = matches[0];
  const amount = Math.round(Number(a.amount) * 100) / 100, cents = Math.round(amount * 100);
  if (!(cents > 0)) refuse("The amount must be more than $0.");
  if (cents > b._balance_cents + 1) refuse(`That is more than the balance due on this booking ($${(b._balance_cents / 100).toFixed(2)}). Nothing was recorded.`);
  const date = a.date ? String(a.date) : todayPT();
  if (!isDate(date)) refuse("The date must look like 2026-11-19.");
  if (date > todayPT()) refuse("A payment can't be dated in the future.");
  const note = oneLine(a.note, 200);
  const cur = (await rest(`nsh_form_responses?select=id,form_id,answers&id=eq.${b._id}`))?.[0];
  if (!cur || ![WEDDING, EVENT].includes(cur.form_id)) refuse("That booking record could not be found.");
  const list: any[] = (Array.isArray(cur.answers?.__venue_checklist?.manual_payments) ? cur.answers.__venue_checklist.manual_payments : []).filter((p: any) => p && p.cents > 0);
  if (list.some((p) => p.cents === cents && p.date === date && p.by === "Claude")) return { changed: false, message: "A payment of that amount on that date was already recorded through Claude. If this is a second, different payment, change the date or the note." };
  const summary = `recorded a $${(cents / 100).toFixed(2)} payment on ${code} ${b.event_type}`;
  if (a.dry_run === true) return { dry_run: true, would: summary, balance_after: (b._balance_cents - cents) / 100 };
  const next = [...list, { id: crypto.randomUUID(), cents, date, note, by: "Claude" }];
  const answers = { ...cur.answers, __venue_checklist: { ...cur.answers?.__venue_checklist, manual_payments: next } };
  const rows = await sbWrite("PATCH", `nsh_form_responses?id=eq.${cur.id}&form_id=eq.${cur.form_id}`, { answers });
  if (!Array.isArray(rows) || rows.length !== 1 || (rows[0].answers?.__venue_checklist?.manual_payments || []).length !== next.length) throw new Error("not saved");
  await audit(summary, { tool: "record_booking_payment", venue_code: code, amount: cents / 100, date });
  return { changed: true, message: summary, balance_due_now: (b._balance_cents - cents) / 100 };
}

const dry = { dry_run: { type: "boolean", description: "Set true to check the change and see what it would do, without saving anything." } };
const WRITE_TOOLS = [
  { name: "add_event_task_update", idempotent: false, run: (a: any) => changeTask(a, "update"),
    description: "Add a short progress update to one task on an event's planning checklist (like the + Update button). Use get_events for the exact event_name and the task_id. Only when the user asks.",
    schema: { type: "object", properties: { event_name: { type: "string", description: "Exact event name from get_events" }, task_id: { type: "string", description: "The task_id from get_events" }, update: { type: "string", description: "The update text, up to 500 characters" }, ...dry }, required: ["event_name", "task_id", "update"] } },
  { name: "mark_event_task_done", idempotent: true, run: (a: any) => changeTask(a, "done"),
    description: "Mark one task on an event's planning checklist as done. It cannot be marked not done again from here. Use get_events for the exact event_name and task_id. Only when the user asks.",
    schema: { type: "object", properties: { event_name: { type: "string" }, task_id: { type: "string" }, ...dry }, required: ["event_name", "task_id"] } },
  { name: "add_event_expense", idempotent: false, run: addExpense,
    description: "Log an expense on an event (it appears in the event's expense list and budget). Amount in dollars, up to $10,000. A repeat of the same expense is not added twice. Only when the user asks.",
    schema: { type: "object", properties: { event_name: { type: "string", description: "Exact event name from get_events" }, description: { type: "string", description: "What the expense was for" }, amount: { type: "number", description: "Dollars" }, date: { type: "string", description: "YYYY-MM-DD, defaults to today" }, type: { type: "string", enum: ["Purchase", "In-Kind"], description: "Purchase (default) or In-Kind" }, ...dry }, required: ["event_name", "description", "amount"] } },
  { name: "add_board_item", idempotent: false, run: addBoardItem,
    description: "Open a new Board Communication item for the board to respond to. item_type is Question (default), Discussion, Update or Vote. A title that already exists is not added again. Only when the user asks.",
    schema: { type: "object", properties: { title: { type: "string" }, item_type: { type: "string", enum: ["Question", "Discussion", "Update", "Vote"] }, description: { type: "string", description: "Optional details, up to 2000 characters" }, response_timing: { type: "string", enum: ["asap", "next_meeting", "date"], description: "When a response is wanted" }, due_date: { type: "string", description: "YYYY-MM-DD, required when response_timing is date" }, on_behalf_of: { type: "string", description: "Optional name shown as who this is for" }, ...dry }, required: ["title"] } },
  { name: "record_booking_payment", idempotent: false, run: recordPayment,
    description: "Record a payment received on a venue booking, found by venue code (from get_venue_bookings). It cannot exceed the balance due, and the same payment on the same date is not recorded twice. Money data: only when the user clearly asks.",
    schema: { type: "object", properties: { venue_code: { type: "string", description: "Like OCT-30-2026" }, amount: { type: "number", description: "Dollars received" }, event_type: { type: "string", description: "Only needed if two bookings share the venue code" }, date: { type: "string", description: "Date received, YYYY-MM-DD, defaults to today" }, note: { type: "string", description: "Optional, e.g. check number" }, ...dry }, required: ["venue_code", "amount"] } },
];

// ---------------------------------------------------------------- MCP (Claude connector)
const MCP_KEY = Deno.env.get("CLAUDE_MCP_KEY") || "";
const TOOLS = [
  { name: "get_venue_bookings", dataset: "bookings", description: "Signed or paid venue bookings (weddings, private events, memorials): type, date, items ordered with prices (e.g. Saturday Wedding, Security Deposit (refundable), Rehearsal), invoice total, paid so far, balance due, payment status, past due, next payment, and the payment schedule. Clients are identified by venue code (the event date), not by name. Amounts are in dollars." },
  { name: "get_events", dataset: "events", description: "The 2027 event plan (date, time, pricing, committee decision and notes), Events Committee events (status, ticket tiers, planning checklist), and per-event finances: the expense list (with the split percentage of ticket sales where a vendor is paid a share), other earnings, tickets sold, ticket sales and net." },
  { name: "get_financials", dataset: "financials", description: "Operating budget spending by area, earnings, the cash log, donations summed by month and type (no donor names), sponsors (businesses) and their in-kind contributions." },
  { name: "get_board_items", dataset: "board", description: "Board Communication items (votes, questions, discussions, updates): title, status, meeting date, decision and response needed. Individual votes, who voted or submitted, and free-text descriptions are never included." },
];
const rpcOk = (id: unknown, result: unknown) => ({ jsonrpc: "2.0", id, result });
const rpcErr = (id: unknown, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });
async function rpc(m: any, rw = false): Promise<unknown | null> {
  if (!m || typeof m !== "object" || m.jsonrpc !== "2.0") return rpcErr(m?.id ?? null, -32600, "Invalid request");
  if (m.id === undefined || m.id === null) return null; // a notification: no reply
  switch (m.method) {
    case "initialize": {
      const asked = m.params?.protocolVersion;
      return rpcOk(m.id, { protocolVersion: ["2025-06-18", "2025-03-26", "2024-11-05"].includes(asked) ? asked : "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "north-star-house-portal", version: "1.0.0" }, instructions: rw ? "North Star House data: venue bookings and payments, events and their finances, financials, and board items (amounts in dollars; clients and donors are not named). You can also make a few narrow changes: add an event task update, mark a task done, log an event expense, open a board item, record a booking payment. Make a change only when the user clearly asks, say what you changed afterwards, and use dry_run first when unsure. Nothing can be deleted." : "Read-only North Star House data: venue bookings and payments, events and their finances, financials, and board items. Amounts are in dollars. Clients and donors are not named." });
    }
    case "ping": return rpcOk(m.id, {});
    case "tools/list":
      return rpcOk(m.id, { tools: [...TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: { type: "object", properties: {} }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } })), ...(rw ? WRITE_TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.schema, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: t.idempotent, openWorldHint: false } })) : [])] });
    case "tools/call": {
      const writer = rw ? WRITE_TOOLS.find((t) => t.name === m.params?.name) : undefined;
      if (writer) {
        try { return rpcOk(m.id, { content: [{ type: "text", text: JSON.stringify(await writer.run(m.params?.arguments || {})) }] }); }
        catch (e) { return rpcOk(m.id, { isError: true, content: [{ type: "text", text: e instanceof Refuse ? e.message : "That change could not be saved. Nothing was changed." }] }); }
      }
      const tool = TOOLS.find((t) => t.name === m.params?.name);
      if (!tool) return rpcErr(m.id, -32602, "Unknown tool");
      try {
        const data = { generated_at: new Date().toISOString(), dataset: tool.dataset, ...(await routes[tool.dataset]() as object) };
        return rpcOk(m.id, { content: [{ type: "text", text: JSON.stringify(data) }] });
      } catch (_e) { return rpcOk(m.id, { isError: true, content: [{ type: "text", text: "Could not read that data right now." }] }); }
    }
    default: return rpcErr(m.id, -32601, "Method not found");
  }
}
async function mcp(req: Request, rw = false): Promise<Response> {
  let body: any;
  try { body = await req.json(); } catch (_e) { return json(rpcErr(null, -32700, "Parse error"), 400); }
  if (Array.isArray(body)) {
    const replies = (await Promise.all(body.map((x: any) => rpc(x, rw)))).filter((r) => r !== null);
    return replies.length ? json(replies) : new Response(null, { status: 202 });
  }
  const reply = await rpc(body, rw);
  return reply === null ? new Response(null, { status: 202 }) : json(reply);
}

Deno.serve(async (req) => {
  const segs = new URL(req.url).pathname.split("/").filter(Boolean);
  const rwi = segs.indexOf("mcp-rw");
  if (rwi >= 0) {
    if (!WRITE_KEY || !same(req.headers.get("x-api-key") || "", WRITE_KEY)) return json({ error: "Not authorized." }, 401);
    if (req.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
    return await mcp(req, true);
  }
  const mi = segs.indexOf("mcp");
  if (mi >= 0) {
    const presented = req.headers.get("x-api-key") || "";
    if (!MCP_KEY || !same(presented, MCP_KEY)) return json({ error: "Not authorized." }, 401);
    if (req.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
    return await mcp(req);
  }
  if (req.method !== "GET") return json({ error: "Read-only: GET requests only." }, 405);
  if (!API_KEY || !same(req.headers.get("x-api-key") || "", API_KEY)) return json({ error: "Missing or wrong x-api-key." }, 401);
  const name = new URL(req.url).pathname.split("/").filter(Boolean).pop() || "";
  const handler = routes[name];
  if (!handler) return json({ error: "Unknown dataset.", datasets: Object.keys(routes) }, 404);
  try { return json({ generated_at: new Date().toISOString(), dataset: name, ...(await handler() as object) }); }
  catch (e: any) { return json({ error: "Could not read that data right now." }, 500); }
});

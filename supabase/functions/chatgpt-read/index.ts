// Read-only data for ChatGPT (a custom GPT "action"). GET only; every request needs the key in the x-api-key header
// (the CHATGPT_READ_KEY secret). Four datasets: /bookings, /events, /financials, /board.
// Nothing here writes, and personal details are never returned: no client or donor names, emails, phone numbers,
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
async function bookings() {
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
    });
  }
  out.sort((x, y) => String(x.event_date || "9999").localeCompare(String(y.event_date || "9999")));
  return { count: out.length, note: "Amounts are in dollars. The security deposit is refundable and is included in the invoice total. Clients are identified by venue code (the event date), not by name.", bookings: out };
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
    committee_events: committee.filter((c: any) => !c.hidden).map((c: any) => ({ name: c.name, date: c.date, start_time: c.start_time, end_time: c.end_time, status: c.status, type: c.purpose || null, description: c.description || null, expected_attendance: c.expected_attendance || null, pricing: priceText(c.pricing), ticket_tiers: (Array.isArray(c.ticket_tiers) ? c.ticket_tiers : []).map((t: any) => ({ name: t.name, price: num(t.price) > 0 ? num(t.price) : "Free", limit: t.limit || null })), checklist: (Array.isArray(c.checklist) ? c.checklist : []).map((t: any) => ({ task: t.text, done: !!t.done, due: t.due || null })) })),
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

Deno.serve(async (req) => {
  if (req.method !== "GET") return json({ error: "Read-only: GET requests only." }, 405);
  if (!API_KEY || !same(req.headers.get("x-api-key") || "", API_KEY)) return json({ error: "Missing or wrong x-api-key." }, 401);
  const name = new URL(req.url).pathname.split("/").filter(Boolean).pop() || "";
  const handler = routes[name];
  if (!handler) return json({ error: "Unknown dataset.", datasets: Object.keys(routes) }, 404);
  try { return json({ generated_at: new Date().toISOString(), dataset: name, ...(await handler() as object) }); }
  catch (e: any) { return json({ error: "Could not read that data right now." }, 500); }
});

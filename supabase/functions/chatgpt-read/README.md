# chatgpt-read: read-only data for ChatGPT

A small read-only web link that a ChatGPT custom GPT ("Action") can call. GET only. Every request needs the key in an
`x-api-key` header; the key is the project secret `CHATGPT_READ_KEY` (not stored in this repo).

Link: `https://uvzwhhwzelaelfhfkvdb.supabase.co/functions/v1/chatgpt-read/<dataset>`

| Dataset | What it returns |
|---|---|
| `/bookings` | Signed or paid venue bookings: type, date, items ordered with prices, total, paid, balance, status, next payment, schedule. Identified by venue code, no names. |
| `/events` | 2027 event plan, Events Committee events (ticket tiers, checklist), per-event finances with the expense list and split percentages. |
| `/financials` | Budget spending, earnings, cash log, donations by month and type (no donors), sponsors and in-kind. |
| `/board` | Board items: title, status, meeting date, decision. No votes, no submitters, no descriptions. |

Never returned: client or donor names, emails, phone numbers, addresses, notes, receipts, individual votes.
Free text that staff typed (event descriptions, budget descriptions, event plan decision notes) can mention staff,
volunteers or paid guest artists by name.

## Connect it in ChatGPT
1. Create a GPT (Explore GPTs > Create > Configure), keep it private ("Only me").
2. Actions > Create new action > paste `openapi.json` from this folder into the Schema box.
3. Authentication > API Key > Auth Type "Custom", Custom Header Name `x-api-key`, paste the key.
4. Save. Ask it a question, e.g. "Which weddings still have a balance due?"

## Rotate or revoke the key
`supabase secrets set CHATGPT_READ_KEY=<a new long random value> --project-ref uvzwhhwzelaelfhfkvdb`
(the old key stops working at once; update the key in the GPT's action). To turn the link off completely, delete the
function: `supabase functions delete chatgpt-read --project-ref uvzwhhwzelaelfhfkvdb`.

## Notes
- `invoice-lines.ts` is a copy of `../client-drive-sync/invoice-lines.ts`; keep the two in step.
- Deploy with `--no-verify-jwt` (the function checks its own key).

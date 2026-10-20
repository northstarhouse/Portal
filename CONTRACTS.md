# Native venue agreements

The Contracts & signatures section is inside Venue Rentals → Clients → View details.

## Staff workflow

1. Create an agreement draft. Existing clients start from their original terms and recorded payment schedule. New clients use the retained wedding or private-event terms. This is an editable draft, never an automatically approved agreement.
2. Complete every `[TO COMPLETE]` field, review the event-specific terms, and enter each client signer's name/email plus the venue countersigner's name/email. Each person needs a separate email.
3. Save, review the saved text, and issue it for signatures. Email delivery is optional and off by default. Personal signing links appear for copying; a failed email is reported separately from creating the agreement.
4. Each signer opens their own page, reviews/downloads the document, requests an email code, types their own full name, and explicitly agrees to sign electronically. Codes are sent only to that recipient and are never BCC'd.
5. The venue countersigns after all clients have signed, using the venue recipient's personal link and email code. Staff login alone cannot create someone else's signature.
6. Download the agreement PDF and its signature/audit appendix. Completed copies can also be sent through the recipient controls.

## Changes and exceptions

- Issued text, signer identities, and recorded signatures are locked. Create a revised draft to change them.
- Describe the changes, save/review the new text, and issue a fresh request. Signatures do not carry forward.
- A completed original remains completed while a replacement is pending or declined. It becomes superseded only once the replacement has all signatures. The original content and signatures remain retained.
- A new issue supersedes an older unfinished request and stops it from accepting signatures.
- Declining requires the recipient's email code and a reason. The request closes; staff can revise it.
- Pending requests expire after 30 days by default. Expired requests require a new version.
- Staff may withdraw a draft or unfinished request with a reason. Completed agreements are retained; changes require a revision or amendment.
- Reminder/new-link actions replace that recipient's old link. A recipient can also have link access revoked without deleting their recorded signature. A new copy link can restore access to a completed agreement.

## Scope and records

This is an electronic signature workflow implemented in the portal; it is not a digital-certificate signature provider. It records explicit consent, verified email, typed name, timestamp, the document SHA-256, and server-observed request evidence. The PDF includes the contract and signature/audit appendix.

The existing staff portal uses a shared app session, so draft/admin audit entries say “Venue staff.” Individual signing/countersigning identities are separately verified through their email codes. This does not replace the staff app's authentication system.

Historical HoneyBook signatures remain imported history. They are never pasted into a newly issued portal agreement. No existing client is automatically sent a new contract.

Contract edits do not silently change a client's imported invoice or collect payments. Payment processing and financial reconciliation remain separate from the agreement workflow.

The database functions/tables are service-role only. The edge function authorizes staff actions using the existing app-session validator; public signing actions require a hashed recipient link and signing additionally requires the email code. The audit history is append-only, and issued text/signatures are protected by database triggers.

## Deployment and tests

- Apply `supabase/migrations_manual/venue_agreements.sql` with the Supabase management CLI against the intended project.
- Deploy only `venue-agreements`, with JWT verification disabled because it handles its own staff-session and recipient-link authorization.
- `RESEND_API_KEY` is required for verification/request emails; it is an existing server secret and never appears in browser code.
- PDF downloads use PDF-Lib, Fontkit, and the included OFL-licensed static Noto Sans font. Static font hosting avoids variable-font rendering failures.
- Run `npm run build`, `node --test scripts/test-venue-clients.cjs scripts/test-venue-agreement-edge.cjs`, and the rollback-only `scripts/test-venue-agreements.sql` integration suite.
- Integration tests use fabricated identities and roll back every record. They do not email clients or modify existing agreements.

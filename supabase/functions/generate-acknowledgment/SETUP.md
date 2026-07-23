# Donor Acknowledgment System — One-Time Setup

Do these in order. Steps 1-2 are Supabase (no coding). Steps 3-5 are Google Cloud
(external to this repo). Step 6 deploys the function. Step 7 configures it from the Portal.

---

## 1. Run the database migration

1. Go to the Supabase dashboard → your project (`uvzwhhwzelaelfhfkvdb`) → **SQL Editor**.
2. Open `supabase/migrations_manual/add_acknowledgment_system.sql` from this repo, copy the whole file.
3. Paste into a new SQL Editor query and click **Run**.
4. Confirm it succeeded: go to **Table Editor** and check that `donations` has new columns
   like `acknowledgment_type`, and that `acknowledgment_templates` / `acknowledgment_settings`
   now exist as tables (with `acknowledgment_templates` pre-populated with 6 rows).

## 2. Create the template storage bucket

1. Supabase dashboard → **Storage** → **New bucket**.
2. Name it exactly `acknowledgment-templates`. Keep it **private** (not public) — the Edge
   Function reads it with the service role key, the browser never touches it directly.
3. Open the bucket and upload all 6 files from `supabase/acknowledgment-templates/` in this repo:
   `membership.docx`, `bricks.docx`, `in-kind.docx`, `tribute.docx`, `restricted.docx`,
   `envelope-standard.docx`. Upload them at the bucket root (no subfolder) — the migration's
   seed rows point at these exact filenames.

## 3. Create a Google Cloud project + service account

1. Go to [console.cloud.google.com](https://console.cloud.google.com) signed in as an owner of
   North Star House's Google Workspace (or create a new project under that org — doesn't need
   to be the same project as anything else).
2. Top bar → project picker → **New Project**. Name it something like `nsh-portal-acknowledgments`. Create it.
3. With that project selected, go to **APIs & Services → Library**, search **Google Drive API**, click it, click **Enable**.
4. Go to **APIs & Services → Credentials → Create Credentials → Service account**.
   - Name: `acknowledgment-doc-generator` (anything descriptive).
   - Skip the optional role-grant and "grant users access" screens — click **Done**.
5. Click into the service account you just created → **Keys** tab → **Add Key → Create new key → JSON**.
   This downloads a `.json` file — **treat it like a password**, it's a full credential.
6. Open that JSON file. Note the `client_email` field (looks like
   `acknowledgment-doc-generator@nsh-portal-acknowledgments.iam.gserviceaccount.com`) — you'll
   need it in the next step.

## 4. Create a Shared Drive and give the service account access

Service accounts have no storage quota in a personal "My Drive," so files must live in a
**Shared Drive**. This requires Google Workspace **Business Standard or higher** (or a
Nonprofits edition that includes Shared Drives) — Business Starter does not support them. Check
your plan in [admin.google.com](https://admin.google.com) → Billing if unsure.

1. Go to [drive.google.com](https://drive.google.com) → left sidebar → **Shared drives** → **New**.
2. Name it (e.g. `North Star House`) — this can be the literal root the folder structure lives
   under, or just a container; either way the app creates the `North Star House / Donor
   Acknowledgments / [Year] / [Month] / [Donor]` folders inside it automatically.
3. Open the Shared Drive → **Manage members** → add the service account's `client_email` from
   step 3.6 → set its role to **Content Manager** → Send/Add (no email will actually go out to
   a service account, that's fine).
4. Get the Shared Drive's ID: open the Shared Drive in the browser, the ID is the last segment
   of the URL — `https://drive.google.com/drive/folders/<THIS_PART>`. Save it, you'll paste it
   into the Portal's admin settings in step 7.

## 5. Store the service account key as a Supabase secret

1. Open the downloaded JSON key file from step 3.5 in a text editor, select all, copy.
2. Supabase dashboard → **Edge Functions** → **Secrets** (or **Settings → Edge Functions**,
   depending on dashboard version).
3. Add a new secret:
   - Name: `GOOGLE_SERVICE_ACCOUNT_KEY`
   - Value: paste the **entire JSON file contents** (starts with `{"type": "service_account", ...`)
4. Confirm `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` are already present as secrets — Supabase
   sets these automatically for every project, but double check under the same Secrets screen.
5. Delete the downloaded JSON file from your Downloads folder once it's pasted in — it's live
   in Supabase now and doesn't need to sit on disk.

## 6. Deploy the Edge Function

From a terminal with the Supabase CLI installed and logged in (`npx supabase login` opens a
browser to authenticate — this has to be done interactively by you, it can't be scripted):

```
cd north-star-portal
npx supabase login
npx supabase link --project-ref uvzwhhwzelaelfhfkvdb
npx supabase functions deploy generate-acknowledgment
```

If `supabase link` asks for a database password, that's your Postgres password from the
Supabase dashboard (**Project Settings → Database**), not your login password.

## 7. Configure it from the Portal

1. In the Portal, go to **Admin → Acknowledgment Templates**.
2. Scroll to **Organization & Envelope Settings**, fill in:
   - Organization Legal Name, EIN
   - Return address (used on the envelope)
   - **Shared Drive ID** — paste the ID from step 4.4
   - Root Folder Name (defaults to "North Star House" — leave as-is unless you want it different)
3. Click **Save Settings**.
4. Scroll up to the template list — the 5 real templates should already show their storage
   paths filled in (from the migration seed). Click **Save** on each once to confirm, or edit if
   you want different signer defaults per type.

## 8. Test it

1. Go to **Donations**, open any donor with a complete mailing address, edit or add a donation,
   set **Acknowledgment Type**, save.
2. Click **Generate Thank-You Documents**, review the screen, click **Generate Letter and Envelope**.
3. Confirm: a Google Doc opens with no leftover `{{...}}` text, the envelope looks right, and
   both appear in the Shared Drive under `North Star House / Donor Acknowledgments / <year> /
   <month> / <donor name>`.
4. If it errors, the message shown is generally specific (missing field, missing address, no
   template configured, Drive auth failure) — check the Edge Function logs in the Supabase
   dashboard (**Edge Functions → generate-acknowledgment → Logs**) for the full stack trace.

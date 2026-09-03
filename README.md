# SPACElogic MR Tracker — e-Signature Edition

Three pages backed by one Supabase database (already fully set up — see "Database" below):

- **`index.html`** — the requisition form. Manager / Approved By / Purchased By / Received By are now dropdowns pulled from a shared people directory (with a "+ Add new person" option to register someone new with a 4-digit PIN). Submitting creates the requisition and a 4-step approval chain, then shows you a link to send to the first signer (the Manager).
- **`sign.html`** — the e-signature page. Whoever gets a link opens it, sees the requisition summary, and enters their name's PIN to **Approve** or **Decline** (with a reason). Only the person assigned to that step can sign it, and steps must be signed in order. Once someone signs, the page shows the next link to copy and send along.
- **`dashboard.html`** — view-only for anyone with the link. Shows every requisition, its current stage, and — click a row — the full approval timeline (who signed, when, or why it was declined). The person whose turn it currently is can also sign/decline right there, after entering their name's PIN.

## How the chain works

1. You fill out the form and pick Manager / Approver / Purchaser / Receiver from the dropdowns (registering new people as needed).
2. Submit → you get a link for the Manager. Copy it and send it however you like (WhatsApp, email, etc.) along with a short note telling them to open it and enter their PIN.
3. The Manager opens the link, enters their PIN, and Approves or Declines.
   - **Approve** → the requisition moves to "Manager Approved," and a new link appears for the next signer (Procurement Approver). Copy and send that one.
   - **Decline** → they give a reason, the chain stops, and the requisition shows as "Declined" everywhere, with the reason visible on the dashboard.
4. This repeats through Approver → Purchaser → Receiver. Once the Receiver signs, the requisition is fully "Received."
5. Anyone can watch progress at any time on the dashboard — no PIN needed to *view*. A PIN is only needed to actually sign or decline.

## Security notes (what's already handled)

- PINs are never stored in plain text and are never sent back to the browser — even the anon API key can't read them. All PIN checks happen inside database functions that only return true/false.
- A step can only be signed by whoever it's assigned to, and only once the previous step is done — this is enforced in the database, not just hidden in the page, so it can't be bypassed by guessing a link.
- 5 wrong PIN attempts on a step locks it for 15 minutes.
- Anyone with the dashboard or a sign link can *view* that requisition — don't post links outside your team.

## Database (already done for this project)

Your Supabase project (`mr-tracker`) already has all of this applied — you don't need to do anything here unless you're setting up a **new/separate** Supabase project. In that case, run `supabase-setup.sql` followed by `esignature-upgrade.sql` (both included) in the SQL Editor, in that order, then update `SUPABASE_URL` / `SUPABASE_ANON_KEY` in all three HTML files.

## Publishing updates to GitHub Pages

You already have a repo and Pages site running the earlier version. To push this upgrade:

1. Go to your GitHub repo.
2. Upload the new/changed files — **`index.html`**, **`sign.html`** (new), **`dashboard.html`** — using "Add file → Upload files." When it asks about `index.html` and `dashboard.html` already existing, confirm you want to replace them.
3. Commit the changes. GitHub Pages redeploys automatically within about a minute — no settings to touch.
4. Your links stay the same as before:
   - Form: `https://yourusername.github.io/your-repo-name/`
   - Dashboard: `https://yourusername.github.io/your-repo-name/dashboard.html`
   - Sign page (only reached via generated links, never typed directly): `.../sign.html?token=...`

## Day-to-day use

- **Registering people**: do it inline from the form's dropdown ("+ Add new person") the first time you need someone. Anyone filling out the form can register a new signer — there's no separate admin step.
- **Forgot to send a link / lost it**: open the dashboard, expand the requisition, and the "Sign / Decline as [name]" button for whoever's turn it currently is will be right there — no need to dig up the original link.
- **A step was declined by mistake**: there's no "un-decline" button by design — start a fresh requisition. If you'd like a resubmit/reopen flow later, that's a reasonable next upgrade.
- **Someone forgot their PIN**: there's no self-service reset yet. For now, open the Supabase dashboard's Table Editor → `people` table, delete their row, and have them re-register from the form's dropdown with a new PIN. (Happy to build a proper reset flow if this comes up often.)

## Possible future upgrades

- A "reopen" action for declined requisitions instead of resubmitting from scratch.
- Self-service PIN reset.
- Email/WhatsApp send button instead of copy-paste (you chose copy-paste for now, but this is a small addition later).
- An admin view of the people directory for editing/removing signers without touching Supabase directly.

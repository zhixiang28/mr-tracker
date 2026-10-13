# SPACElogic MR Tracker — e-Signature Edition

Three pages backed by one Supabase database (already fully set up — see "Database" below):

- **`index.html`** — the requisition form. Manager / Approved By / Purchased By / Received By are now dropdowns pulled from a shared people directory (with a "+ Add new person" option to register someone new with a 4-digit PIN). Submitting creates the requisition and a 4-step approval chain, then shows you a link to send to the first signer (the Manager).
- **`sign.html`** — the e-signature page. Whoever gets a link opens it, sees the requisition summary, and enters their name's PIN to **Approve** or **Decline** (with a reason). Only the person assigned to that step can sign it, and steps must be signed in order. Once someone signs, the page shows the next link to copy and send along.
- **`dashboard.html`** — view-only for anyone with the link. Shows every requisition, its current stage, and — click a row — the full approval timeline (who signed, when, or why it was declined). Signing is done only through the sign link (PIN) or the PDF e-sign link; the dashboard has buttons to copy both.

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
- **Forgot to send a link / lost it**: open the dashboard, expand the requisition, and use **Copy PIN sign link** or **Copy PDF e-sign link** to get the link again.
- **A step was declined by mistake**: there's no "un-decline" button by design — start a fresh requisition. If you'd like a resubmit/reopen flow later, that's a reasonable next upgrade.
- **Someone forgot their PIN**: there's no self-service reset yet. For now, open the Supabase dashboard's Table Editor → `people` table, delete their row, and have them re-register from the form's dropdown with a new PIN. (Happy to build a proper reset flow if this comes up often.)

## Possible future upgrades

- A "reopen" action for declined requisitions instead of resubmitting from scratch.
- Self-service PIN reset.
- Email/WhatsApp send button instead of copy-paste (you chose copy-paste for now, but this is a small addition later).
- An admin view of the people directory for editing/removing signers without touching Supabase directly.

## Hybrid mode: drawn-signature PDF page (`esign.html`)

For a transition period where approvers sign on the PDF form instead of using PINs, while the record still lives in the tracker:

1. On the form, click **PDF Sign** (next to **PIN Sign**). The MRF is saved to the tracker (same record and tracking number as PIN Sign) and a link to `esign.html` is copied. You can also copy it again from any requisition's expanded row on the dashboard.
2. Whoever opens the link sees the MRF laid out like the SPACElogic PDF form. The next slot in order (Team Manager, Approve, Purchase, Received) shows a **Tap to sign** box: they type their name and draw their signature with finger or mouse.
3. Each signature is stored against the requisition, advances its stage on the dashboard, and appears there as a "drawn signature" with a thumbnail.
4. Anyone with the link can **Export PDF** (with the signatures so far) and keep their own copy.

Notes: there is no PIN on this page, so anyone holding the link can sign the next open slot. Only share it with the intended signers. Signing is strictly in order. The database part is in `esign-pdf-upgrade.sql` (already applied to the live project).

`esign-hardening.sql` (run after `esign-pdf-upgrade.sql`) tightens `sign_step`, `decline_step` and `requester_resubmit`: a withdrawn/declined requisition can't be signed through an already-claimed link, and resubmitting clears drawn signatures and typed-only names.

## Analytics page (`analytics.html`) — everyone (each person sees only the data they can access)

Procurement analytics over all requisitions, scoped by a period filter. Total value (with change vs the previous period), average/median requisition, "done within 7 days" rate, **savings opportunity** (extra paid over the lowest price ever paid for the same item × quantity), decline rate; value over time with a 3-period moving average; approval funnel with stage-to-stage conversion; time per approval step (average, median, 90th percentile); value by project (top-3 concentration) and by supplier; savings opportunity by item; price movers (first vs latest price); open requisitions by waiting time and the longest-waiting list; requisitions by requester. Every chart has a "View as table" and tooltips; dark mode supported. Admins see every requisition; everyone else sees the requisitions they submitted or are asked to sign (the by-requester chart is admin-only).

## Purchase History (`items.html`) — everyone

Search everything bought before (company-wide, excluding declined/withdrawn; "Include not yet purchased" widens it): per item the times bought, last bought, last price, best price (and who), quantity-weighted average price and a "price vs best" check. Expand an item to see every purchase (date, REQ, product link, qty, price, project, requester), price by supplier and a price trend. A **Suppliers** tab shows spend per supplier and what was bought from each. Tick items and **Add to a new requisition** to prefill the form (qty and price from the last purchase), or export the filtered list to CSV. Suppliers are derived from each item's product link (the form has no separate supplier field). Backed by `list_purchase_history` (`purchase-history.sql`).

## How similar item names are matched (Purchase History & Analytics)

`itemmatch.js` groups names that mean the same thing: case, punctuation, plurals and word order are ignored ("M3 screws" = "screw M3"), near-identical names / typos are merged automatically, but names whose sizes or numbers differ stay apart ("M3 screw" ≠ "M4 screw"). Names that are only similar show up as **"Could be the same item?"** with a **Yes, combine** button; ticking two or more items offers **Combine as one item**; each name variant has **Not the same** to separate it again. These choices are stored for everyone in `item_aliases` (`item-aliases.sql`; rows are switched off, never deleted).

## Dashboard layout

Header: Purchase History · Analytics · (Admin Settings) · refresh · your name menu (My Profile, Reminder Settings, Manual, FAQ, Log out). Below: the seven stage boxes (click one to filter), a search box with a **Needs action** shortcut, **Group by** (Status, Stage, Project, Requester, Month, No grouping — remembered per browser) and a stage filter. Rows that need you carry small tags (Awaiting your signature / Declined — needs your fix / Overdue).

## Same layout on every page

`appbar.js` draws one header on every signed-in page — brand, **Dashboard · Purchase History · Analytics · (Admin Settings)**, and your-name menu (My Profile, Reminder Settings, Manual, FAQ, Log out) — followed by a page heading with the title on the left and that page's actions on the right (dashboard: My Drafts + New requisition; form: My Drafts + Save Draft; full view: Print + Export PDF; Purchase History: Export CSV; Analytics: period). The form's header links open in a new tab so an unsaved form isn't lost. The sign pages (`sign.html`, `esign.html`), login and the manual are separate on purpose.

## Pick past purchases on the form, and Account settings

- **Item box suggestions** (`history.js`): click or type in an item's *Name* box on the requisition form to see items bought before (company-wide, purchased/received only), with last price, supplier, date and the cheapest price paid. Choose one (mouse or ↑↓ Enter) to fill the description, quantity (if empty), unit price and product link. Esc closes it; if nothing matches you just keep typing your own item.
- **Account settings** (name menu → My Profile / Change PIN): one window with *Profile* and *Change PIN* tabs. Profile saves only when something changed and the email looks valid; the PIN tab accepts digits only, shows live match/strength hints, has Show PINs, warns about easy PINs and tells you if the current PIN is wrong. Esc closes it and keyboard focus stays inside the window.
- **Upgrade notice**: shown once per browser per version (`NOTICE_ID` in `appbar.js`), with a "Don't show this again" box ticked by default.

## Shared projects (Projects page, admins) and the live currency converter

- **Projects** (`projects.html`, admins only; `projects.sql`): add, edit, archive/restore projects (name, location, PC no., PM in-charge) or paste a whole list from Excel. Everyone picks from the same list on the form: typing in *Project name* or *PC no.* filters it, and choosing one fills in location, PC no. and PM. Archived projects disappear from the form but are never deleted.
- **Currency converter** now fetches a live rate when opened or when the currencies change (European Central Bank via frankfurter.dev, then open.er-api.com, then jsDelivr currency-api as fallbacks), shows where/when the rate is from, has a Refresh button, and still lets you type your own rate if the services can't be reached.

## Version & "What's new"
The version number (`VERSION` in `appbar.js`) shows under **Log out** in the name menu; clicking it reopens the "What's new" list. When shipping a change, bump `VERSION` and `NOTICE_ID` and edit the `NOTICE` list so everyone sees the notice once.

## Assistant ("Ask" button)
`assistant.js` is loaded by `appbar.js` on every page. It answers with rules first (requisition look-ups, what needs you, summaries, spend, built-in FAQ) and falls back to the `assistant-ai` Supabase Edge Function (`supabase/functions/assistant-ai`) using Google Gemini (model name in `ai_settings`, default `gemini-flash-latest`). Limits live in the `ai_settings` table (`monthly_token_cap`, `daily_questions_per_user`, `max_output_tokens`, `enabled`) and usage is logged in `ai_usage`. The function needs the `GEMINI_API_KEY` secret; without it the assistant simply stays rule-based.

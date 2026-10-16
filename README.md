# SPACElogic MR Tracker — e-Signature Edition

Three pages backed by one Supabase database (already fully set up — see "Database" below):

- **`index.html`** — the requisition form. Manager / Approved By / Purchased By / Received By are now dropdowns pulled from a shared people directory (with a "+ Add new person" option to register someone new with a 4-digit PIN). Submitting creates the requisition and a 4-step approval chain, then shows you a link to send to the first signer (the Manager).
- **`sign.html`** — the e-signature page. Whoever gets a link opens it, sees the requisition summary, and enters their name's PIN to **Approve** or **Decline** (with a reason). Only the person assigned to that step can sign it, and steps must be signed in order. Once someone signs, the page shows the next link to copy and send along.
- **`dashboard.html`** — view-only for anyone with the link. Shows every requisition, its current stage, and — click a row — the full approval timeline (who signed, when, or why it was declined). Signing is done only through the sign link (PIN) or the PDF e-sign link; the dashboard has buttons to copy both.
- **`drafts.html`** — full-page list of your saved drafts (item count, total, last saved) with Continue / Delete. The form (`index.html`) autosaves itself as a draft 2.5 s after you stop typing, once it has at least one named item; it stops autosaving while editing a submitted requisition or while submitting.

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
   - Sign page (only reached via generated links, never typed directly): `.../esign.html?token=...` (old `sign.html?token=...` links redirect there)

## Day-to-day use

- **Registering people**: do it inline from the form's dropdown ("+ Add new person") the first time you need someone. Anyone filling out the form can register a new signer — there's no separate admin step.
- **Forgot to send a link / lost it**: open the dashboard, expand the requisition, and use **Copy signing link** on the requisition to get the link again.
- **A step was declined by mistake**: there's no "un-decline" button by design — start a fresh requisition. If you'd like a resubmit/reopen flow later, that's a reasonable next upgrade.
- **Someone forgot their PIN**: there's no self-service reset yet. For now, open the Supabase dashboard's Table Editor → `people` table, delete their row, and have them re-register from the form's dropdown with a new PIN. (Happy to build a proper reset flow if this comes up often.)

## Possible future upgrades

- A "reopen" action for declined requisitions instead of resubmitting from scratch.
- Self-service PIN reset.
- Email/WhatsApp send button instead of copy-paste (you chose copy-paste for now, but this is a small addition later).
- An admin view of the people directory for editing/removing signers without touching Supabase directly.

## Signing (`esign.html`) — one way for everyone

1. On the form, press **Submit for approval**. The requisition is saved and one signing link (`esign.html?token=...`) is copied/shown, with a box to email it.
2. Whoever opens the link sees the MRF laid out like the SPACElogic PDF form. The next slot in order (Team Manager, Approve, Purchase, Received) shows **Tap to sign or decline**.
3. **Approve & sign**: draw a signature. Signed-in people also enter their PIN (`esign_sign_step_as`, linked to their account); others type their name (`esign_sign_step`). **Decline**: give a reason (`esign_decline_step` / `esign_decline_step_as`).
4. A step already tied to an account can only be signed by that person, signed in. The requester gets an email when it is declined, purchased or received (`get_esign_notification`).
5. Anyone with the link can **Export PDF** with the signatures so far. Old `sign.html` links redirect here.

## Analytics page (`analytics.html`) — everyone (each person sees only the data they can access)

Procurement analytics over all requisitions, scoped by a period filter. Total value (with change vs the previous period), average/median requisition, "done within 7 days" rate, **savings opportunity** (extra paid over the lowest price ever paid for the same item × quantity), decline rate; value over time with a 3-period moving average; approval funnel with stage-to-stage conversion; time per approval step (average, median, 90th percentile); value by project (top-3 concentration) and by supplier; savings opportunity by item; price movers (first vs latest price); open requisitions by waiting time and the longest-waiting list; requisitions by requester. Every chart has a "View as table" and tooltips; dark mode supported. Admins see every requisition; everyone else sees the requisitions they submitted or are asked to sign (the by-requester chart is admin-only).

## Purchase History (`items.html`) — everyone

Search everything bought before (company-wide, excluding declined/withdrawn; "Include not yet purchased" widens it): per item the times bought, last bought, last price, best price (and who), quantity-weighted average price and a "price vs best" check. Expand an item to see every purchase (date, REQ, product link, qty, price, project, requester), price by supplier and a price trend. A **Suppliers** tab shows spend per supplier and what was bought from each. Tick items and **Add to a new requisition** to prefill the form (qty and price from the last purchase), or export the filtered list to CSV. Suppliers are derived from each item's product link (the form has no separate supplier field). Backed by `list_purchase_history` (`purchase-history.sql`).

## How similar item names are matched (Purchase History & Analytics)

`itemmatch.js` groups names that mean the same thing: case, punctuation, plurals and word order are ignored ("M3 screws" = "screw M3"), near-identical names / typos are merged automatically, but names whose sizes or numbers differ stay apart ("M3 screw" ≠ "M4 screw"). Names that are only similar show up as **"Could be the same item?"** with a **Yes, combine** button; ticking two or more items offers **Combine as one item**; each name variant has **Not the same** to separate it again. These choices are stored for everyone in `item_aliases` (`item-aliases.sql`; rows are switched off, never deleted).

## Dashboard layout

Header: Purchase History · Analytics · (Admin Settings) · refresh · your name menu (Settings, Quick tour, Manual, FAQ, Log out). Below: the seven stage boxes (click one to filter), a search box with a **Needs action** shortcut, **Group by** (Status, Stage, Project, Requester, Month, No grouping — remembered per browser) and a stage filter. Rows that need you carry small tags (Awaiting your signature / Declined — needs your fix / Overdue).

## Same layout on every page

`appbar.js` draws one header on every signed-in page — brand, **Dashboard · Purchase History · Analytics · (Admin Settings)**, and your-name menu (Settings, Quick tour, Manual, FAQ, Log out) — followed by a page heading with the title on the left and that page's actions on the right (dashboard: My Drafts + New requisition; form: My Drafts + Save Draft; full view: Print + Export PDF; Purchase History: Export CSV; Analytics: period). The form's header links open in a new tab so an unsaved form isn't lost. The sign pages (`sign.html`, `esign.html`), login and the manual are separate on purpose.

## Pick past purchases on the form, and Account settings

- **Item box suggestions** (`history.js`): click or type in an item's *Name* box on the requisition form to see items bought before (company-wide, purchased/received only), with last price, supplier, date and the cheapest price paid. Choose one (mouse or ↑↓ Enter) to fill the description, quantity (if empty), unit price and product link. Esc closes it; if nothing matches you just keep typing your own item.
- **Settings** (name menu → Settings, `settings.html`): everything personal in one page — *Account* (profile, saved signature, Change PIN), *Notifications* and *Reminders*. Profile saves only when something changed and the email looks valid; the PIN form accepts digits only, shows live match/strength hints, has Show PINs, warns about easy PINs and tells you if the current PIN is wrong. Esc closes it and keyboard focus stays inside the window.
- **Upgrade notice**: shown once per browser per version (`NOTICE_ID` in `appbar.js`), with a "Don't show this again" box ticked by default.

## Shared projects (Projects page, admins) and the live currency converter

- **Projects** (`projects.html`, admins only; `projects.sql`): add, edit, archive/restore projects (name, location, PC no., PM in-charge) or paste a whole list from Excel. Everyone picks from the same list on the form: typing in *Project name* or *PC no.* filters it, and choosing one fills in location, PC no. and PM. Archived projects disappear from the form but are never deleted.
- **Currency converter** now fetches a live rate when opened or when the currencies change (European Central Bank via frankfurter.dev, then open.er-api.com, then jsDelivr currency-api as fallbacks), shows where/when the rate is from, has a Refresh button, and still lets you type your own rate if the services can't be reached.

## Version & "What's new"
The version number (`VERSION` in `appbar.js`) shows under **Log out** in the name menu; clicking it reopens the "What's new" list. When shipping a change, bump `VERSION` and `NOTICE_ID` and edit the `NOTICE` list so everyone sees the notice once.

## Assistant ("Ask" button)
`assistant.js` is loaded by `appbar.js` on every page. It answers with rules first (requisition look-ups, what needs you, summaries, spend, built-in FAQ) and falls back to the `assistant-ai` Supabase Edge Function (`supabase/functions/assistant-ai`) using Google Gemini (model name in `ai_settings`, default `gemini-flash-latest`). Limits live in the `ai_settings` table (`monthly_token_cap`, `daily_questions_per_user`, `max_output_tokens`, `enabled`) and usage is logged in `ai_usage`. The function needs the `GEMINI_API_KEY` secret; without it the assistant simply stays rule-based.

## Notifications (Telegram + phone/browser alerts) and Settings

`settings.html` (name menu → *Settings & notifications*) has three tabs: Notifications, Reminders (overdue limits) and Account. People connect Telegram, switch on email (sent via the existing `send-email` function, off by default) and/or turn on alerts for the device they are on, and choose what to be told about (needs my action, progress on my requests, declined, overdue reminders). After sending a form, anyone who never chose is offered it once (`notifysetup.js`).

How it works: a database trigger on `approval_steps` (and an hourly `pg_cron` job for overdue reminders) calls the Edge Function `notify-dispatch`, which sends via Telegram and web push. `telegram-webhook` links a Telegram chat to an account when the person presses Start. `sw.js` + `manifest.webmanifest` make the site installable and show the alerts. Server-side keys live in Supabase Vault (`notify_secret`, `vapid_private`, `telegram_webhook_secret`); the only secret set by hand is `TELEGRAM_BOT_TOKEN`. SQL is in `notifications.sql`.

One-time Telegram setup: create a bot with @BotFather, add its token as the Edge Function secret `TELEGRAM_BOT_TOKEN`, open `https://<project>.supabase.co/functions/v1/telegram-webhook?setup=1` once, then store the bot's username: `insert into notify_config(key,value) values ('telegram_bot','<username without @>') on conflict (key) do update set value=excluded.value;`. The `site_url` row in `notify_config` must be the site's address (used for the "Open" links).

The older automatic emails (declined / purchased / received) are switched off: `get_esign_notification` and `get_notification_target` now return nothing (the originals are kept as `*_legacy`, with no access). Emails are only sent to people who switch on **Email** in Settings, using the same events as the other channels. The purchaser is told (as *progress*) when their purchase is marked received.

## New Materials Requisition Form (3 signing steps + Authorisation Limit page)

New requisitions have **3 signing steps**: *Verified by* the manager the amount requires → *Procurement* (a one-tap **Mark as ordered** button, no signature) → *Received* (a one-tap **Mark as received** button). Only step 1 is signed; the buttons call `esign_confirm_step_as` and record the person and time. Requisitions created earlier keep their 4 steps; every page and database function handles both (`MRF.isLegacy(steps)` in `mrf.js`, `mrf-flow.sql`).

`mrf.js` holds the **Authorisation Limit** table from page 2 of the form (Section Manager up to $300 · Team Manager up to $500 · Division Head up to $1,000 · Top Management above; quotes $50k+ need a PO, $150k+ an LOA). It drives: the live "who must verify" box and the **Approval rules** pop-up (a reference, not printed on the form or its PDF), and the "who signs" list on the submit confirmation. The signed form has exactly 3 signature boxes: Verified by · Procurement · Received by.

### Appointments, verifier, vendor details, supply date (`mrf-levels.sql`)
- **Appointment** per person (Section Manager / Team Manager / Division Head / Top Management), set by an admin in *Admin → People*. The form lists the people who may verify the total and the requester can pick one (they are assigned and notified). An admin switch *Check appointments when signing* makes the server refuse a verification signature from someone below the level (off by default so nothing is blocked until appointments are set).
- **$50,000+** needs the vendor quotation ref and PO number; **$150,000+** also an LOA number unless ticked *supply of goods only* (checked in the database when submitting; the revise path calls `set_requisition_details` first).
- **Supply date**: the form warns if it is less than 3 working days ahead; an hourly job tells the requester (event *Overdue reminders*) when the supply date is tomorrow/today/past and the items are not received.

### Procurement role
Admin → People can give anyone the **Procurement role** (`people.is_procurement`, `admin_set_procurement`). The *Procurement* box in Admin → Notifications decides whether they are told; when it is ticked and the verification step is signed, every person with the role gets an "is ready for Procurement" notification (Telegram / email / device, per their own Settings) with the signing link. Each contact must turn on a channel in Settings → Notifications to receive it.

### Notification routing (Admin → "Notifications — who gets what")
`notify_rules` holds, for each event (`submitted`, `verified`, `purchased`, `received`, `declined`, `overdue`, `supply_date`), an on/off switch, recipient groups (`requester`, `assigned` verifier, `assigned_next`, `procurement` contacts, `buyer`, `admins`) and extra named people. `rule_recipients()` resolves them; `trg_notify_steps()` and the hourly `notify_run_reminders()` use it. Defaults reproduce the old behaviour. Each person still chooses their own channels and can mute types in Settings → Notifications. SQL applied live; see the migrations `notify_rules_a_*` / `notify_rules_b_*`.

### Roles & access (Admin → "Roles & access")
Everyone is a **Member**; admins give people more **roles** with the *Roles* button on each member, and tick what each role may do: **see everyone's requisitions** (enforced in the database: `list_my_requisitions`, `is_authorized_for_requisition`), **Analytics page**, **Purchase History page** (hidden from the menu and replaced by a "no access" message — the data they would show is the same as the Dashboard's), and **manage projects** (enforced in `admin_list_projects` / `admin_save_project`). New roles can be added and archived. Built-in: *Member* (baseline), *Procurement* (its members are who the "Procurement" notification box means), *Admin* (everything; also unlocks the Admin page). Tables `roles`, `person_roles`; helpers `has_perm`, `verify_perm`, `get_my_access`; the old `is_admin` / `is_procurement` flags are kept in step. The last admin cannot be demoted. The Appointment (signing level) stays a separate setting.

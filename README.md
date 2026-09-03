# SPACElogic MR Tracker

Two pages backed by one free Supabase database:

- **`index.html`** — your original Materials Requisition form, unchanged, plus a **"Submit to Dashboard"** button that saves the requisition to Supabase (still keeps Export PDF / CSV / Print / Share exactly as before).
- **`dashboard.html`** — a live tracker showing every submitted requisition, its approval stage (Submitted → Manager Approved → Procurement Approved → Purchased → Received), and which line items have arrived.

Access model: anyone with the dashboard link can view and update status — there's no login. Treat the link like an internal tool and don't post it publicly.

## 1. Create the Supabase project (free)

1. Go to [supabase.com](https://supabase.com) → sign up (free tier is enough for this) → **New project**.
2. Pick any name/region and a database password (you won't need the password again — the app uses the API key instead).
3. Once the project is ready, open **SQL Editor** in the left sidebar → **New query**.
4. Paste in the entire contents of `supabase-setup.sql` (included in this folder) and click **Run**. This creates the two tables (`requisitions`, `requisition_items`), the auto-numbering, and the access policies.
5. Go to **Project Settings → API**. You'll need two values:
   - **Project URL** (e.g. `https://xxxxx.supabase.co`)
   - **anon public** key (a long string under "Project API keys")

## 2. Connect the two HTML files to your project

Open both `index.html` and `dashboard.html` in a text editor and find this block near the top of the `<script>` section in each file:

```js
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
```

Replace the two placeholder strings with the values from step 1.5. Save both files.

## 3. Publish with GitHub Pages (free)

1. Create a new GitHub repository (public or private both work with Pages on a free plan — public is simplest).
2. Upload `index.html`, `dashboard.html`, and `supabase-setup.sql` to the repository (drag-and-drop on github.com works fine, or `git push`).
3. In the repo, go to **Settings → Pages**.
4. Under "Build and deployment", set **Source** to "Deploy from a branch", branch `main`, folder `/ (root)`. Save.
5. Wait ~1 minute, then GitHub shows your live URL, something like:
   `https://yourusername.github.io/your-repo-name/`
6. The form is at that URL directly (`.../index.html` or just `/`), and the dashboard is at
   `https://yourusername.github.io/your-repo-name/dashboard.html`.

Share the dashboard link with whoever needs to see or update approval status.

## How it works day to day

- Someone fills out the form and clicks **Submit to Dashboard**. This creates one row in `requisitions` (with an auto-generated tracking number like `REQ-00001`) and one row per material in `requisition_items`. The form shows the tracking number once it succeeds.
- If they reopen the same browser/device and click Submit again before it's approved, it **updates** the same record instead of creating a duplicate (the button relabels itself "Update Submission"). Submitting from a different device always creates a new record — treat the form as source-of-truth only until submission.
- On the dashboard, the stage pills at the top show a live count per approval stage. Click one to filter the table to just that stage.
- Each row's **Stage** dropdown lets anyone move a requisition forward (or back) through the workflow; the timestamp for that stage is recorded automatically.
- Clicking a row expands it to show every material line, with a checkbox to mark each as received. Once every item on a requisition is checked off, the requisition's stage automatically flips to "Received."
- All of this is just data in your Supabase tables — you can always open the **Table Editor** in Supabase directly if you want to query, export, or bulk-edit something the dashboard doesn't cover.

## Notes and limits

- **No login / open editing**: since anyone with the link can update data, this suits a small trusted team. If you later want to restrict who can change status, the natural upgrade is Supabase's built-in email/password auth plus tightening the SQL policies to require `auth.role() = 'authenticated'` — happy to help with that later if needed.
- **Free tier limits**: Supabase's free tier pauses a project after 7 days of no API activity (it wakes back up automatically on the next request, with a short delay) and caps storage/bandwidth generously enough for this kind of internal form. GitHub Pages is free and unlimited for a repo this size.
- **Editing after "Received"**: nothing locks a record after it reaches "Received" — the dropdown can still be moved back if someone submitted in error.

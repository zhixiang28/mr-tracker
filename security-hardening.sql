-- Security hardening, October 2026. ALL OF PART 1-3 IS ALREADY APPLIED to the live project.
-- Part 4 is to be run AFTER the sign-in-by-email change is live on the site.

-- 1) Nobody with the public (anon) key can write through the people_public view or touch the people table directly.
revoke insert, update, delete, truncate, references, trigger on public.people_public from anon, authenticated, public;
grant select on public.people_public to anon, authenticated;
revoke all on public.people from anon, authenticated, public;

-- 2) All app data is reached through SECURITY DEFINER functions that check the PIN; remove leftover direct table access
--    (old policies let anyone with the public key update/delete requisitions and line items).
revoke all on public.requisitions, public.requisition_items, public.approval_steps, public.drafts, public.item_aliases, public.projects,
  public.pending_registrations, public.admin_setup_code, public.ai_settings, public.ai_usage from anon, authenticated, public;

-- 3) PIN lockout (5 wrong tries = 15 minutes) inside verify_pin, sign in by email (login_by_email) and has_any_admin().
--    See the migration "email_login_and_pin_lockout" (pin_attempts table, verify_pin, login_by_email, has_any_admin).

-- 4) TO RUN AFTER the email sign-in release is live: stop publishing the list of names.
-- revoke select on public.people_public from anon, authenticated;
-- drop view public.people_public;

-- 5) Email is required, unique and locked for users (ALREADY APPLIED): people_email_required check + unique index on lower(email);
--    update_my_profile no longer changes the email; update_my_name (users can rename themselves; signed history keeps the old name);
--    admin_set_person_email (admins can correct someone's sign-in email).

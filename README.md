# Bourbon & Bubbles Volunteer Hub

Private coordination app for Opa's Learning Academy's Bourbon & Bubbles fundraiser (Friday April 9, 2027).
See `SPEC.md` for the full spec and decisions.

- **App:** Vite + React + TypeScript + Tailwind, hosted on Netlify (`bourbon-bubbles-hub`)
- **Database/Auth:** Supabase project `apjgoanfhrvqwzcmrvzv`, Google sign-in, allowlist enforced in RLS

## Local development

```bash
npm install
cp .env.example .env   # fill in VITE_SUPABASE_ANON_KEY (publishable key from Supabase > Project Settings > API Keys)
npm run dev
```

Google sign-in only redirects to URLs listed in Supabase (Authentication > URL Configuration).
Add `http://localhost:5173` there if you want to sign in locally.

## Environment variables (Netlify > Site configuration > Environment variables)

| Name | Where it's used | Secret? |
|---|---|---|
| `VITE_SUPABASE_URL` | browser | no |
| `VITE_SUPABASE_ANON_KEY` | browser (Supabase publishable key) | no (RLS protects data) |
| `SUPABASE_SERVICE_ROLE_KEY` | reminder function only | **yes** |
| `RESEND_API_KEY` | reminder function only | **yes** |
| `REMINDER_FROM` | reminder sender, e.g. `Bourbon & Bubbles <info@opaslearningacademy.org>` | no |

Never commit `.env` or any key.

## Adding or removing a user

Admins: open **Users** (sidebar on desktop, **More → Users** on a phone), enter the person's name and the
Google email they'll sign in with, choose Volunteer or Admin. Remove with the trash icon.
Emails are matched case-insensitively. The last admin can't be removed or demoted.

Anyone who signs in with an email not on the list is signed straight back out and told to ask an admin.

## Database

Migrations live in `supabase/migrations/` and have been applied to the project.
`supabase/tests/rls_check.sql` is a rolled-back smoke test of the access rules (outsider / volunteer / admin);
paste it into the Supabase SQL editor to re-run it after changing policies.

## Reminder emails (Resend)

A Netlify Scheduled Function emails each user, at about 6 PM Eastern, the tasks due tomorrow plus anything overdue.
It stays off until:

1. A Resend account exists and `RESEND_API_KEY` is set in Netlify.
2. **The `opaslearningacademy.org` domain is verified in Resend.** Whoever manages that domain's DNS must add the
   records Resend shows (Resend > Domains > Add domain). Until then, set `REMINDER_FROM` to a sender on a verified domain.
3. An admin turns reminders on in **Settings**. Each person can opt out in **My profile**.

How it runs: `netlify/functions/send-reminders.mts` is scheduled at 22:00 and 23:00 UTC and only sends in the run
where it is 6 PM in New York (that covers daylight saving). It emails tasks due tomorrow plus anything overdue,
one email per person, and `reminder_log` prevents a second email the same day.

Testing: **Settings → Send me a test reminder** (admins) calls `/api/reminder-test`, which emails the signed-in admin
their own digest immediately (not logged). Until the domain is verified, `REMINDER_FROM` is set to Resend's test
sender `onboarding@resend.dev`, which **only delivers to the email address that owns the Resend account**. After
verification, change `REMINDER_FROM` in Netlify to `Bourbon & Bubbles <info@opaslearningacademy.org>` and redeploy.

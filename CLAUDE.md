# Bourbon & Bubbles Volunteer Hub

Read `SPEC.md` first; it is the source of truth. Event assets are in this folder (sponsorship packet .docx, logo .jpg).

Working rules:
- Build in this order: repo + Netlify site + env vars, Supabase schema/RLS/migrations, Google auth + allowlist, app shell with mobile nav, then modules in this order: Tasks, Companies (auction/sponsor/distributor + CSV import), Ticket Sales, Tables, Ideas, Budget, Dashboard, reminder function.
- Supabase project ref is `apjgoanfhrvqwzcmrvzv` (already created, empty). Use migrations and test RLS for admin vs volunteer vs non-listed users.
- Never commit secrets. Ask Jay for the Google OAuth client credentials and Resend API key when needed, and give step-by-step instructions.
- Confirm with Jay: Ashley's email spelling (spec uses opaslearningacademy.org).
- Check in with Jay after the first deploy (login working) before building the remaining modules; he wants volunteers using it within a few days, so ship Tasks, Companies and Tickets first and iterate.

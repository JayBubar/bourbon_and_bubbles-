# Bourbon & Bubbles 2027 — Volunteer Hub: Build Spec

Event: Opa's Learning Academy annual fundraiser, **Friday April 9, 2027, 6:00 PM**, The Laundry, 2046 Talley St, Columbia SC 29201 (BullStreet District). Kentucky Derby theme. Seating capped at **140 guests**. General tickets **$150**. Fiscal sponsor: Central Carolina Community Foundation (CCCF).

Purpose: a small private web app for fewer than 10 volunteers (3 admins) to coordinate the event. Ticket sales happen elsewhere; this app only TRACKS them (no payments).

Source material in this folder: `Bourbon_Bubbles_2027_Sponsorship_Packet_v2.docx` (packages), `Gemini_Generated_Image_qf6hh8qf6hh8qf6h.jpg` (event logo; copy to `public/` and derive palette from it: navy, burgundy/rose red, gold, cream).

## Stack and infrastructure
- Front end: Vite + React + TypeScript + Tailwind, `@supabase/supabase-js`. React Router. Responsive, mobile-first, installable PWA (manifest + icons from logo; offline support not required).
- Hosting: Netlify. **Create the GitHub repo and Netlify site yourself** (Jay asked Claude Code to do this; use the Netlify and GitHub tooling available, or the CLIs). Site name suggestion: `bourbon-bubbles-hub`.
- Database/Auth: Supabase project **"Bourbon and Bubbles"**, ref `apjgoanfhrvqwzcmrvzv`, URL `https://apjgoanfhrvqwzcmrvzv.supabase.co`, region us-east-1. Already created and empty. Use migrations (SQL files in `supabase/migrations/`). Never commit keys; use Netlify env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`).
- Auth: Supabase Auth with the **Google provider**. Jay must create the Google OAuth client (Google Cloud Console) and paste client ID/secret into Supabase; give him exact step-by-step instructions including the redirect URI and the Netlify site URL to add to Supabase URL configuration.
- Reminders: a **Netlify Scheduled Function** runs daily at **6:00 PM America/New_York** (changed from 7 AM per Jay, 2026-10-29) and emails each user their tasks due **tomorrow** or overdue (one digest email per person, skip if none). Send with **Resend** from `info@opaslearningacademy.org`. That domain must be verified in Resend (DNS records added by whoever manages opaslearningacademy.org); until then, build so the sender address is an env var (`REMINDER_FROM`) and note the dependency in the README.

## Access control
- Allowlist table `allowed_users(email, name, role)`; role is `admin` or `volunteer`. Sign-in with a Google account whose email is not on the list must be rejected (sign them out and show "Ask an admin to add your email"). Enforce in RLS too, not just the UI.
- Seed admins:
  - Jay Bubar — jaybubar@gmail.com
  - Virginia Wells — virginia@opaslearningacademy.org
  - Ashley Bubar — **Ashley@opaslearningacademy.org** (Jay typed "achademy" in his message; that is almost certainly a typo, use the correct spelling and tell Jay to confirm)
- Volunteers have Gmail accounts; admins use Google Workspace. Match emails case-insensitively.
- Admins: everything, plus Users page (add/remove/change role) and **Budget** (volunteers cannot see the Budget page, its data, or the budget tile on the dashboard; enforce in RLS).
- Volunteers: read and edit everything else.

## Modules (v1)

### 0. Dashboard
Tiles: tickets sold vs 140 capacity (seats committed = preordered tickets + tickets included in sponsorships; flag if over capacity); money raised vs goal (default goal **$50,000, editable in Settings**; define "raised" = ticket revenue + committed sponsorship dollars; show auction estimated value separately, not as cash); sponsorship $ committed / paid; auction items secured and received; tasks due this week and overdue; budget spent vs planned (admins only). Plus recent activity feed.

### 1. Silent Auction Targets (companies)
Company list with fields: name, category/industry, contact name, title, email, phone, website, address, owner (assigned volunteer), status (`Not contacted → Reached out → Following up → Yes → No`), last contact date, notes. Stage 2: when status is Yes, record one or more **auction items** (description, estimated value, received yes/no, bid sheet number, donor display name). Filters by status, owner, search; sortable.

### 2. Corporate Sponsorship Outreach
Same company record pattern with `kind = sponsor`. Adds: package/level (from `sponsor_levels`), amount committed, amount paid, invoice sent, tickets included (default from level), table assigned (see Tables), tax-deductible portion, and a **deliverables checklist** per sponsor (seeded from the level's benefits, editable).
Seed levels from the packet:
| Level | Price | Tickets | Table | Key benefits |
|---|---|---|---|---|
| Presenting | $5,000 | 8 | Reserved table of 8 near stage | Exclusive Presenting Sponsor, top logo placement, recognition in remarks, signage, private reserve bourbon tasting, reserve bottle at table, promotions + post-event ack |
| Bourbon | $2,500 | 8 | Reserved table of 8 | Prominent logo, recognition in remarks, signage, private table tasting by distributor partner, promotions + post-event ack |
| Believe | $1,000 | 4 | no | Name/logo on materials, signage recognition, post-event ack |
| Belong | $500 | 2 | no | Name on materials, post-event ack |
| Friend | $250 | 0 | no | Name recognition; gift for those who can't attend |
Levels are editable by admins.
Also support `kind = distributor` (Distributor & Brand Partners: spirits distributors/brand reps providing product and tasting hosts for the bourbon trail; contact for questions is Virginia Wells). Same status workflow; fields for product provided and tasting host. Present as a third tab on the same screen.

### 3. Ticket Sales (tracking only)
Rows: buyer name, email, phone, quantity, unit price (default $150), amount paid, payment method (check, card elsewhere, cash, other), date, source (who sold it), guest names (optional), dietary notes, table assignment, tax-deductible portion (admin may leave blank), notes. Totals and progress bar vs capacity. Mobile "quick add" form with the minimum fields (name, qty, paid yes/no).

### 4. Ideas Board
Categories: Entertainment (band/DJ), Venue/Decor, Food, Drinks, Program, Auction ideas, Other. Status `Idea → Considering → Finalized → Rejected`. Each idea: title, description, link, estimated cost, vendor name/contact, volunteer thumbs-up votes (one per user, toggle). When Finalized, optional fields: contract signed, deposit amount and due date, and a button "Add to budget" that creates a linked budget line (admin only). Comment thread on each idea.

### 5. Tasks and Calendar
Tasks: title, description, assignee (one of the allowed users), due date, status (`To do / Doing / Done`), optional link to a company, idea, or sponsor. Views: My Tasks (default on phone), All Tasks, and a month **calendar** showing tasks by due date plus event milestones. Daily email reminders as described above; each user can opt out in their profile. Seed milestone tasks backward from April 9, 2027 (save-the-date, sponsor deadline, auction items due, final headcount, etc.) — keep to roughly 15 reasonable ones and mark them editable.

### 6. Budget (admin only)
Lines: category, description, vendor, estimated amount, actual amount, paid yes/no, due date, linked idea. Totals by category, planned vs actual, remaining. **No income side in v1** (planned for later), but show a read-only "ticket + sponsor revenue so far" line for admins at the top for context. CSV export.

### 7. Tables (seating inventory)
Inventory: 10 round 60-inch tables, 2 eight-foot banquet tables, 4 cocktail tables (cocktail tables are not seated tables). Fields: label, type, seats (default 8 for rounds; make editable, banquet default 8), notes. Admins can add more. Assign sponsors (reserved tables) and ticket buyers to tables; show seats filled and a computed "seated capacity vs headcount" warning (e.g. 10 rounds x 8 = 80 seats short of 140, so more tables needed).

### Cross-cutting
- **Comments/activity log** on every company, idea, sponsor, task, and ticket row: short threaded notes with author and timestamp, replacing a single notes field.
- **CSV import** for companies (auction and sponsor lists): upload, map columns, preview, dedupe on company name, choose which list (`kind`) and default owner. Provide a downloadable CSV template. Jay does not have the list yet, so make import robust to messy headers.
- **Settings page** (admin): event name/date, ticket price, capacity, revenue goal, sponsor levels, reminder on/off.
- Audit fields (`created_by`, `created_at`, `updated_at`) on all tables.

## Mobile requirements
Whole app responsive with bottom tab navigation on phones. Designed-for-thumb screens: **My Tasks** (tap to complete), **Outreach** company detail with quick "log a call" (status change + note in one sheet), **Ticket quick-add**, **Ideas** (browse + vote). Budget, CSV import, and Settings need only be usable, not optimized. Touch targets at least 44px, no horizontal page scroll, tables collapse to cards on small screens.

## Visual design
Elegant Derby feel drawn from the logo: deep navy, burgundy/rose red, antique gold, cream background; a classic serif for headings (e.g. Playfair Display or similar via Google Fonts), clean sans for UI. Use the logo in the header and login page. Dark mode not required.

## Data model (suggested; adjust as needed, keep RLS on every table)
`allowed_users`, `settings`, `companies` (kind: auction|sponsor|distributor), `auction_items`, `sponsor_levels`, `sponsor_deliverables`, `ticket_sales`, `event_tables`, `ideas`, `idea_votes`, `tasks`, `comments` (polymorphic: entity_type, entity_id), `budget_items`, `reminder_log`. Helper SQL functions `is_allowed()` and `is_admin()` (security definer) used by policies. Budget policies admin-only.

## Decisions confirmed with Jay (2026-10-29)
- Ashley's email is `Ashley@opaslearningacademy.org` (confirmed).
- GitHub repo: https://github.com/JayBubar/bourbon_and_bubbles-.git (Jay created it). Netlify site `bourbon-bubbles-hub`, no custom domain planned.
- "Raised": ticket revenue counts **amount paid**; unpaid tickets still count toward seats. Sponsorships count **committed** dollars, with paid shown separately.
- Seeded milestone tasks start unassigned. All dates/times are America/New_York.
- Reminder email at 6 PM ET the evening before (due tomorrow + overdue); off until Resend key and domain DNS are ready.

## Phase 2 (not in v1)
Guest check-in on event night; volunteer roster and event-day roles; Google Calendar sync; export of buyers/sponsors/donors to OLA's donor database (Bloomerang or similar); income side of budget; tax receipt generation for CCCF.

## Definition of done for v1
Deployed on Netlify behind Google sign-in; the three admins can log in; a non-listed Google account is blocked; every module works on a phone; CSV import tested with a messy sample file; reminder function tested with a manual trigger; README covering env vars, how to add a user, and the Resend domain step.

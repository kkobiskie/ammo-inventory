# Armory Inventory Manager V2.1 — GitHub Pages Edition

This is the GitHub-ready conversion of V2. The Flask/SQLite server has been replaced by a static browser application suitable for GitHub Pages plus a Supabase PostgreSQL/Auth backend for shared departmental data.

## What changed from V2
- No Python, Flask, Waitress, or `run_windows.bat` is required on user workstations.
- Static app can be hosted by GitHub Pages.
- Supabase provides authentication and the shared PostgreSQL database.
- PostgreSQL RPC functions make inventory movements atomic and enforce server-side roles.
- Row Level Security (RLS) protects database tables from unauthenticated access and blocks direct client writes.
- V2 workflows retained: products, UPC lookup, lots, receive, issue, return, transfer, physical count, supervisor adjustment approval, inventory, transaction ledger, roles, and audit events.
- PWA manifest/service worker included for home-screen installation and cached application shell.

## Important architecture note
GitHub Pages cannot run the original Python/SQLite backend. GitHub hosts only the front end. Operational inventory records and authentication live in Supabase. Do **not** commit passwords, service-role keys, database dumps, or sensitive operational exports to GitHub.

## 1. Create the Supabase backend
1. Create a Supabase project controlled by the department/city.
2. Open the SQL Editor and run `supabase/schema.sql`.
3. In Authentication, create the first user with an email address and strong password.
4. Copy that user's UUID from Authentication > Users.
5. In SQL Editor run:

```sql
insert into public.profiles(id, display_name, role)
values ('PASTE-AUTH-USER-UUID-HERE', 'Administrator Name', 'ADMIN');
```

6. For each additional user, create the Authentication user and then create a matching `profiles` row using role `ADMIN`, `SUPERVISOR`, `ARMORER`, or `READONLY`.

## 2. Configure the app
Open `config.js` and enter the Supabase Project URL and the **publishable/anon** key. The anon/publishable key is designed for browser clients; RLS and the RPC functions provide authorization. Never put a Supabase service-role/secret key in this repository.

```js
window.AMMO_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT.supabase.co",
  supabaseAnonKey: "YOUR-PUBLISHABLE-ANON-KEY"
};
```

In Supabase Authentication URL configuration, add your GitHub Pages URL to the allowed site/redirect URLs.

## 3. Publish to GitHub
1. Create a repository, for example `ammo-inventory`.
2. Upload all files/folders in this package to the repository root.
3. Use `main` as the branch.
4. In GitHub repository Settings > Pages, set the source to **GitHub Actions**.
5. Push/commit. The included `.github/workflows/pages.yml` publishes the site.
6. Open the GitHub Pages URL and sign in with the first Supabase user.

## 4. Security before operational use
V2.1 is an application prototype and should receive an agency security review before real ammunition-room records are entered. At minimum: require HTTPS (GitHub Pages does), enable MFA in Supabase, disable public sign-ups, define password/session policy, replace sample personnel, review RLS and RPC permissions, establish encrypted database backups and retention, test restore procedures, configure audit/alerting, and conduct vulnerability/penetration testing appropriate to agency policy.

### Supabase settings to review
- Authentication > Providers: disable open/public user registration if not required.
- Authentication > MFA: enable an agency-approved MFA method.
- Authentication > URL Configuration: restrict redirects to the production GitHub Pages URL.
- Database: retain RLS on every operational table.
- Never expose the service-role key in browser JavaScript.

## Barcode scanners
USB/Bluetooth scanners operating as keyboard/HID devices remain the reliable baseline. Focus the UPC field and scan. Camera barcode scanning is not required by V2.1 because browser/iPhone support can vary.

## PWA/offline behavior
The application shell is cached so it can launch like a PWA, but inventory operations require connectivity to Supabase. This is intentional: V2.1 does not queue offline inventory transactions because doing so could create conflicting or unreviewed ammunition balances.

## Data migration from V2 SQLite
This package does not automatically upload an existing `armory.db`. If V2 already contains operational data, export/migrate that database separately so user UUIDs and foreign keys can be mapped safely. If the V2 database is empty/test-only, start with the new Supabase schema.

## Files
- `index.html` — application UI
- `css/styles.css` — responsive styling
- `js/app.js` — Supabase client and V2 workflows
- `config.js` — deployment configuration
- `supabase/schema.sql` — PostgreSQL schema, RLS, and atomic inventory functions
- `.github/workflows/pages.yml` — GitHub Pages deployment
- `manifest.json` / `service-worker.js` — PWA support

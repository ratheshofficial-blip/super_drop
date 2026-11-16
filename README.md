# SuperDrop

A mobile-first creator-support platform for India. This version uses Supabase
for creator accounts, creator pages, support messages, private payout settings,
admin actions and live stream alerts. Checkout deliberately stays simulated:
no Razorpay, UPI payment or other real payment is initiated.

## Run the demo

```powershell
npm install
npm run dev
```

Visit `/demo`, `/dashboard`, `/admin`, `/overlay/demo`, `/terms`, `/privacy`
or `/refunds`. Without Supabase credentials the app runs locally using
browser storage and sample data. Local creator login and admin tools are
demonstrations, not authentication or production controls.

## Connect Supabase

1. Create a Supabase project.
2. In **SQL Editor**, run [`supabase/schema.sql`](./supabase/schema.sql)
   followed by
   [`supabase/migrations/20261116000000_full_version.sql`](./supabase/migrations/20261116000000_full_version.sql).
   Run both files in that order.
3. Configure **Authentication → Providers** for email OTP and, if desired,
   Google OAuth. Add your local and production app URLs to the allowed redirect
   URLs.
   Review [email sending limits](./EMAIL_SENDING_LIMITS.md) before testing
   sign-in or enabling email OTP for public users.
4. Copy `.env.example` to `.env.local` and set the project URL and **anon /
   publishable key**. Never put the service-role key in the browser app.
5. Install and log in to the [Supabase CLI](https://supabase.com/docs/guides/cli),
   link the project and set a random server-only rate-limit secret:

   ```powershell
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase secrets set RATE_LIMIT_SECRET=YOUR_RANDOM_32_BYTE_SECRET
   supabase functions deploy submit-support
   ```

   The Supabase Edge Function runtime provides its project URL and service-role
   key. Keep those server-side. The deploy reads
   [`supabase/config.toml`](./supabase/config.toml), which permits the public
   mock-support endpoint without a login JWT; the function validates every
   request, hashes the client network identifier, and enforces a three-per-
   minute rate limit in the database.
6. Restart the Vite server.

Creator sign-up generates a unique username and profile. Authenticated creators
can edit their profile, view messages, reply, mark requests done, see actual
date-filtered **mock support totals**, save private payout preferences, and
copy/rotate a private OBS overlay URL. Admin accounts must receive
`app_metadata.role = "admin"` from a trusted server-side process; never grant
admin roles through client-editable user metadata. Admin RPCs verify that claim.

### Supabase verification

- Enable Realtime for `public.supports` if the publication was customized.
- In the Supabase SQL editor, check `profiles`, `creator_private_settings`,
  `supports` and `settings`; row-level security is enabled for each table.
- Submit support on a creator page; the submission is saved with
  `payment_status = 'mock'`. No transaction or earnings are collected.
- Test unauthorized users against `/dashboard` and `/admin`, then verify
  creator isolation and admin RPC behavior with separate accounts.

## Deploy the web app

```powershell
npm run build
npm run preview
```

Deploy to Vercel with the included `vercel.json`; it sets the Vite build,
`dist` output, and SPA route fallback. Add the two `VITE_SUPABASE_*`
environment variables in **Vercel → Project → Settings → Environment
Variables**, then redeploy so they are available at build time. For Netlify or
another static host, use build command `npm run build`, output directory
`dist`, and configure a history fallback to `index.html` for username paths,
the dashboard, admin, overlay and policy routes. Add the production URL to
Supabase Auth's allowed redirect URLs.

## Payment and payout scope

The checkout is a clearly labelled simulation. The server persists support
submissions and marks them `mock`; the dashboard/admin call them mock support
totals, **not earnings or settled payments**. Admin platform-fee settings are
saved, but are not collected. Bank/UPI payout preferences are private to the
creator account and are not used to make transfers. Do not collect real payout
details or advertise financial services until a regulated payment/payout
integration, operational controls and final legal terms are in place.

## Before public launch

The `/terms`, `/privacy` and `/refunds` pages are starter copy; obtain legal
review and publish your actual business/contact information. Supabase setup,
OAuth providers, email delivery, function secrets, rate limits and admin
claims must be configured and verified for your project. Do not expose service
keys. The included abuse filter is a basic safeguard, not content moderation.

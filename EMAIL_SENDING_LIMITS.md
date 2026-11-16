# SuperDrop email sending limits

**Applies to:** Supabase Auth email sign-in codes (OTP) and confirmation emails
**Checked:** November 16, 2026

## How many emails can SuperDrop send?

The limit depends on the email delivery service configured for the Supabase
project:

| Configuration | Current limit and restrictions |
| --- | --- |
| Supabase built-in email service | **2 emails per project per hour.** It only delivers to addresses belonging to members of the Supabase organization's team. It is for testing, not production. |
| Custom SMTP | Supabase starts with a **30 emails per hour** project limit. The limit can be adjusted in the Supabase dashboard, subject to Supabase controls and the SMTP provider's own sending quota and account limits. |
| Send Email Auth Hook | The email service used by the hook sets its own quota. Configure Supabase Auth rate limits and the delivery service's limits for the expected volume. |

These are project-wide sending limits shared by Auth email operations; the
quota is not reserved per user or per email type. Supabase can change built-in
service limits. Check the project's dashboard before relying on a number.

## Other Auth limits to account for

- **OTP or magic-link resend:** Supabase's default limit allows a new request
  for the same user once every **60 seconds**. This interval is configurable
  in **Authentication → Rate Limits**.
- **Auth requests per IP:** Sign-up and sign-in endpoints, including OTP
  requests, default to **30 requests per 5 minutes per IP**, with bursts up to
  30 requests. This limit is configurable. It is not an allowance to send 30
  emails: the project-wide email delivery quota still applies.
- A request can be rejected by any applicable limit, including the project
  email quota, the per-user resend interval, the IP request limit, or the SMTP
  provider's own quota.

## What this means for SuperDrop

The app's email sign-in uses Supabase OTP (`signInWithOtp`). With the built-in
email service, it is suitable only for testing with team-member addresses and
the project will be limited to two Auth emails per hour. A public launch needs
a custom SMTP provider or a Send Email Auth Hook, verified sender/domain
configuration, and rate limits appropriate for the expected sign-in traffic.

The dashboard's **Authentication → Rate Limits** settings control Supabase
Auth throttling. They do not increase an SMTP provider's plan quota. Check the
provider's current plan, daily/monthly caps, sender verification requirements,
and warm-up policy separately. No specific custom-provider email count can be
promised until a provider and plan are selected.

## Configure and verify

1. In Supabase, open **Authentication → SMTP Settings** and configure a
   production SMTP provider (or configure an Auth email hook).
2. Verify the sender address/domain with the provider and set the sender details
   in Supabase.
3. Review **Authentication → Rate Limits**, including the email-send project
   limit and the per-user OTP interval.
4. Check the provider's sending dashboard and deliverability reports after
   testing. Do not repeatedly resend OTPs while testing; the project, user and
   IP limits are independent.

## Official references

- [Supabase Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits)
- [Supabase custom SMTP setup and restrictions](https://supabase.com/docs/guides/auth/auth-smtp)

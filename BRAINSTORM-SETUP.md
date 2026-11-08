# Temporary Sable brainstorm page

This adds `/brainstorm` as a separate, PIN-gated concept page to the static Teroir Vercel project. It does not add a link to the public site navigation.

## Free short-term hosting

Vercel Hobby includes routing middleware / serverless functions. This implementation serves the page from a function, so the page HTML is not an independently downloadable public static file. Vercel's built-in production password feature is not used.

Configure these Vercel production environment variables before deploying:

- `BRAINSTORM_PIN`: a randomly generated 6–8 digit numeric PIN. Share it privately with the demo guests.
- `BRAINSTORM_SECRET`: at least 32 random bytes, used to sign the temporary access cookie. Generate with `openssl rand -base64 48` and enter it only in Vercel settings.
- `BRAINSTORM_EXPIRES_AT`: ISO timestamp with timezone, for example `2026-11-12T23:59:00-06:00`. Choose the actual end of the demo; after this time the endpoint returns HTTP 410 even if someone has a valid cookie.

The signed HttpOnly/Secure/SameSite cookie expires after at most 72 hours and never later than `BRAINSTORM_EXPIRES_AT`. Failed PIN attempts are throttled to 12 per 15 minutes per observed client IP per warm function instance. The instance-local throttle is a speed bump, not a durable account lockout. This suits a short casual demo; it is not suitable for confidential files or long-lived access control. Avoid putting sensitive material on the page.

## Disable after the demo

Remove the two rewrite entries for `/brainstorm` from `vercel.json` and deploy; optionally remove `api/brainstorm.js` and `api/brainstorm-page.js` too. The configured expiration date is an automatic backstop. Do not leave the PIN active after the event.

## Preview and local tests

`node api/brainstorm.test.js` checks PIN rejection/acceptance, cookie signature and expiration, noindex headers, expiry cutoff and the per-instance throttle. Open `api/brainstorm-page.js`'s exported HTML in a browser to inspect the standalone mockup. The Vercel route itself needs the three environment variables and a Vercel preview deployment to test end-to-end.

The page has its own visual identity, an interactive Core/Muse/Form selector and an illustrative price slider. Its economics are explicitly hypothetical. No performance, safety, prototype, traction or manufacturing-readiness claims are presented as validated.

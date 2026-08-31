# Go-Live Blockers

The cumulative codebase is ready for staging integration, but production go-live still requires:

- real Supabase production/staging projects and environment variables
- configured private storage buckets
- real SMS provider credentials and a completed Twilio adapter
- real transactional email provider credentials and adapter
- Playwright/Chromium available in deployment runtime
- domain/DNS and HTTPS
- creation of real internal users and roles
- full staging execution of the integration checklist
- backup/restore test
- provider delivery/compliance review
- final verification of generated proposal/invoice layouts on mobile and print

No phase package should be described as live until those credential-dependent and staging tests are complete.

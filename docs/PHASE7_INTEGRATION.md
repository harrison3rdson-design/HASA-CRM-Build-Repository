# Phase 7 Integration

Phase 7 completes the first full navigation flow from internal operations to customer mobile acceptance.

## Internal detail pages
- `/clients/[clientId]`
- `/proposals/[proposalId]`
- `/projects/[projectId]`
- `/billing/[invoiceId]`

These pages assemble the related records needed for practical daily use:
client history, revision history, project financials, time, expenses, additional services, invoices, payments, and delivery history.

## Public mobile pages
- `/public/proposals/[token]`
- `/public/additional-services/[token]`

The public pages:
- accept only tokenized links
- validate hashed token server-side
- enforce expiry/revocation
- register document views
- return only customer-safe data
- present an electronic acceptance form

The customer does not need an account.

## Important acceptance limitation

The public acceptance pages call the Phase 3 API acceptance routes. Those routes were intentionally scaffolded earlier and still need to be converted from HTTP 501 scaffolds into live database/PDF/storage transactions before production go-live.

That should be the first task in Phase 8.

## Internal navigation integration

Update Phase 5 listing screens so row links route to the new detail pages:
- client row → `/clients/[id]`
- proposal row → `/proposals/[id]`
- project row → `/projects/[id]`
- invoice row → `/billing/[id]`

## CSS

Import `phase7-details.css` into the authenticated app layout.
Public pages import `public.css` directly.

## Next phase

Phase 8 should finish the live acceptance/send/document pipeline:
1. implement proposal send action
2. implement authorization send action
3. implement live proposal acceptance transaction
4. implement live authorization acceptance transaction
5. generate executed PDFs
6. hash/store executed PDFs
7. revoke acceptance links
8. send confirmation copy
9. implement invoice generation/send pipeline

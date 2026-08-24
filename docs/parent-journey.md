# Parent replacement journey

## Entry paths

- Public self-service: `/repair/start`, with one field that accepts either a device serial or child phone number
- Browser handoff: `/repair/start?serial=202112T2E235968&parentEmail=parent@gmail.com` resolves the supplied serial and opens directly on device confirmation with the parent email prefilled. The email must still be verified before the customer continues.
- Parent-app deep link: a short-lived server-signed `entry` token containing the parent email and device serial
- Staff-created secure intake link: generated from the Support queue and valid for seven days

## Local mock records

| Model | Serial | Child phone |
| --- | --- | --- |
| Teracube 2e | `202112T2E235968` | `(206) 555-0142` |
| Teracube 2s | `202503T2S118842` | `(206) 555-0177` |
| Teracube 4 | `202401TC4009317` | `(206) 555-0199` |
| Teracube 4 | `202402TC4009418` | `(206) 555-0164` |
| Teracube 2e | `202403T2E236105` | `(206) 555-0185` |

Any unrecognized serial or phone follows the unidentified-device support path. The attempted identifier is carried into the Support-only conversation, and the parent can include up to three photos with the initial description so Support does not have to ask for the same evidence again.

The sample device records intentionally do not prefill a reserved `example.com` address. The parent must enter an inbox they can access and complete email verification.

## Contact verification

- Email syntax is checked first, but syntax alone is never treated as proof. A six-digit, single-use code verifies access to the inbox, and the resulting server-signed assertion is bound to that exact normalized email for 30 minutes.
- Reserved documentation domains such as `example.com` and `.invalid` are rejected.
- Local development displays the code in the form when Postmark is not configured. When Postmark credentials are present, the code is delivered privately; production never returns it to the browser.
- The local address mock recognizes and standardizes Teracube's public contact address: `16625 Redmond Way, Ste M-175, Redmond, WA 98052`.
- The production address adapter will replace the mock with a deliverability validator. An order is rejected if its address differs from the server-validated, signed value.

## Flow

1. Resolve the device through the mock Thrive provider and plan through the mock Gigs provider.
2. Confirm derived model, serial, manufacture month, masked ICCID, and plan state.
3. Capture structured and free-text customer-reported fault, with up to three optional photos.
4. Infer the initial warranty/accident path from the report; CS remains authoritative at verification.
5. Show only process types configured for the model. Pricing appears only after the parent selects advance or regular.
6. Repeat the explicit promise that the customer receives a different refurbished unit.
7. Verify the contact inbox, validate and standardize the shipping address, then run a mock Shopify checkout. No card data is requested. The validated address is encrypted before PostgreSQL persistence.
8. Create an order-scoped 30-day tracking token and secure on-site conversation. A configured helpdesk adapter may mirror the order for internal records, but email is not required for parent replies.
9. Hold the order at `awaiting_verification` until the Support milestone releases it. If Support identifies a previously unknown device, collect and validate any missing shipping address on the secure tracking page before release.
10. Show plain-language tracking for the return and replacement as separate physical legs, provide the printable return label, and update the conversation automatically while the page is open.

## Mock pricing

Pricing is deployment configuration, so the local seed uses replaceable mock values:

- Warranty fee: `$0`
- Accidental-damage fee: `$49`
- Advance refundable deposit: `$80`
- Regular deposit: `$0`

These values are not intended as approved production pricing.

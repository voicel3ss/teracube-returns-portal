# Parent replacement journey

## Entry paths

- Public self-service: `/repair/start`
- Parent-app local deep link: `/repair/start?entry=parent-app-preview`
- CS-generated pre-authenticated links use the same intake and customer-token foundation; the CS creation surface is implemented in Major Step 4.

## Local mock records

| Model | Serial | Child phone |
| --- | --- | --- |
| Teracube 2e | `202112T2E235968` | `(206) 555-0142` |
| Teracube 2s | `202503T2S118842` | `(206) 555-0177` |
| Teracube 4 | `202401TC4009317` | `(206) 555-0199` |

Any unrecognized serial or phone follows the unidentified-device support path.

The sample device records intentionally do not prefill a reserved `example.com` address. The parent must enter an inbox they can access and complete email verification.

## Contact verification

- Email syntax is checked first, but syntax alone is never treated as proof. A six-digit, single-use code verifies access to the inbox, and the resulting server-signed assertion is bound to that exact normalized email for 30 minutes.
- Reserved documentation domains such as `example.com` and `.invalid` are rejected.
- The local email delivery mock displays the code in the form. A production email adapter must send it privately and must never return it to the browser.
- The local address mock recognizes and standardizes Teracube's public contact address: `16625 Redmond Way, Ste M-175, Redmond, WA 98052`.
- The production address adapter will replace the mock with a deliverability validator. An order is rejected if its address differs from the server-validated, signed value.

## Flow

1. Resolve the device through the mock Thrive provider and plan through the mock Gigs provider.
2. Confirm derived model, serial, manufacture month, masked ICCID, and plan state.
3. Capture structured and free-text customer-reported fault.
4. Infer the initial warranty/accident path from the report; CS remains authoritative at verification.
5. Show only process types configured for the model. Pricing appears only after the parent selects advance or regular.
6. Repeat the explicit promise that the customer receives a different refurbished unit.
7. Verify the contact inbox, validate and standardize the shipping address, then run a mock Shopify checkout. No card data is requested. The validated address is encrypted before PostgreSQL persistence.
8. Create a mock Freshdesk communication ticket and an order-scoped 30-day tracking token.
9. Hold the order at `awaiting_verification` until the CS milestone releases it.
10. Show plain-language tracking for the return and replacement as separate physical legs.

## Mock pricing

Pricing is deployment configuration, so the local seed uses replaceable mock values:

- Warranty fee: `$0`
- Accidental-damage fee: `$49`
- Advance refundable deposit: `$80`
- Regular deposit: `$0`

These values are not intended as approved production pricing.

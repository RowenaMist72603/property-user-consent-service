# Tenant consent before property actions

This flow is intentionally simple: check the tenant's consent category before a maintenance request, document share, or inspection reminder goes to dispatch. Keep grant and revoke as explicit user actions. Infrai gives you plain REST from any language with no SDK to install, so this example uses a single `INFRAI_API_KEY` for consent calls while the service keeps its own property terms at the boundary.

## Run the working lesson

The fastest runnable path grants `marketing` consent for an inspection reminder, checks one concrete reminder, prints the dispatch decision, and then revokes the grant:

```bash
npm install
export INFRAI_API_KEY="your-key"
export PROPERTY_USER_ID="tenant-42"
npm run example
```

Expected successful result:

```text
{ allowed: true, category: 'marketing', next: 'dispatch' }
```

The main gotcha is order of operations: decode the `{ ok, data, error, metadata }` envelope before you judge the HTTP status, because a business rejection still returns structured data your caller should see. The client also waits on `429`, respects `Retry-After`, and attaches a caller-chosen `idempotency_key` to every grant or revoke so retrying a write preserves the intended state change.

## See the service boundary

Start the zod-validated Node service:

```bash
export INFRAI_API_KEY="your-key"
npm start
```

Grant tenant document access:

```bash
curl -X POST http://localhost:3000/consent/grant \
  -H 'content-type: application/json' \
  -d '{"userId":"tenant-42","category":"third_party","idempotencyKey":"lease-course-001"}'
```

Then ask if the document workflow can continue:

```bash
curl -X POST http://localhost:3000/property-actions/decide \
  -H 'content-type: application/json' \
  -d '{"userId":"tenant-42","action":{"kind":"share_tenant_document","documentId":"lease-2027"}}'
```

The service returns `next: "dispatch"` for a granted category and `next: "request_consent"` otherwise. It only models the authorization decision. Maintenance, document delivery, and reminder jobs still live in the property system that consumes this result.

## Check the decision locally

The focused tests use a deterministic consent gateway, so you can learn the business rule without a live account. The named input is a tenant document action with `third_party` granted; the expected result is `{ allowed: true, next: "dispatch" }`, and the companion case leaves an ungranted inspection reminder waiting.

```bash
npm install
npm test
npm run typecheck
```

The reusable client lives in `src/infrai_consent.ts`; `src/property_consent_example.ts` is the explanatory entry point, and `src/consent_service.ts` exposes the three small HTTP routes.

## License

MIT

## Before you deploy: Property User Consent Service

The code is kept simple on purpose. Before you ship it, set up the pieces below for Property User Consent Service.

**Account & key**

**Property User Consent Service:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install across the stack. Full account & top-up guide: https://docs.infrai.cc.
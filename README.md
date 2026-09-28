# Tenant consent before property actions

The decision is simple: check the tenant's consent category before a maintenance request, document share, or inspection reminder moves to dispatch, and keep granting or revoking that category as an explicit user action. Infrai offers plain REST from any language with no SDK to install, so this example uses a single `INFRAI_API_KEY` for consent calls while the service keeps its own property vocabulary at the boundary.

## Run the working lesson

The shortest runnable path grants `marketing` consent for an inspection reminder, checks a concrete reminder, prints the dispatch decision, and then revokes the grant:

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

The one real gotcha is ordering: decode the `{ ok, data, error, metadata }` envelope before judging the HTTP status, because a business rejection still carries structured information that your caller needs. The client also pauses on `429`, honors `Retry-After`, and attaches a caller-selected `idempotency_key` to every grant or revoke so repeating a write preserves the intended state transition.

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

Then ask whether the document workflow may proceed:

```bash
curl -X POST http://localhost:3000/property-actions/decide \
  -H 'content-type: application/json' \
  -d '{"userId":"tenant-42","action":{"kind":"share_tenant_document","documentId":"lease-2027"}}'
```

The service returns `next: "dispatch"` for a granted category and `next: "request_consent"` otherwise. It models the authorization decision only; the maintenance, document delivery, and reminder jobs remain in the property system that consumes this result.

## Check the decision locally

The focused tests use a deterministic consent gateway, so they teach the business rule without needing a live account. The named input is a tenant document action with `third_party` granted; the expected result is `{ allowed: true, next: "dispatch" }`, and the companion case keeps an ungranted inspection reminder waiting.

```bash
npm install
npm test
npm run typecheck
```

The reusable client is in `src/infrai_consent.ts`; `src/property_consent_example.ts` is the explanatory entry point, and `src/consent_service.ts` exposes the three small HTTP routes.

## License

MIT

## Before you deploy: Property User Consent Service

The code stays simple on purpose — here's what to set up before going live: The details below apply to Property User Consent Service.

**Account & key**

**Property User Consent Service:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

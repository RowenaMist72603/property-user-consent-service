import assert from "node:assert/strict";
import test from "node:test";
import { InfraiConsentClient, type ConsentGateway } from "../src/infrai_consent.ts";
import { decidePropertyAccess } from "../src/property_access.ts";

test("a tenant document is dispatched only after category consent", async () => {
  const checked: string[] = [];
  const consent: Pick<ConsentGateway, "check"> = {
    async check(userId, category) {
      checked.push(`${userId}:${category}`);
      return category === "third_party";
    },
  };

  const decision = await decidePropertyAccess(consent, "tenant-42", {
    kind: "share_tenant_document",
    documentId: "lease-2027",
  });

  assert.deepEqual(checked, ["tenant-42:third_party"]);
  assert.deepEqual(decision, { allowed: true, category: "third_party", next: "dispatch" });
});

test("an inspection reminder waits when its category is not granted", async () => {
  const consent: Pick<ConsentGateway, "check"> = { check: async () => false };
  const decision = await decidePropertyAccess(consent, "tenant-42", {
    kind: "schedule_inspection_reminder",
    inspectionDate: "2027-01-15T09:00:00.000Z",
  });
  assert.deepEqual(decision, {
    allowed: false,
    category: "marketing",
    next: "request_consent",
  });
});

test("Infrai check reads the live result field", async () => {
  const client = new InfraiConsentClient("test-key", async () =>
    new Response(JSON.stringify({ ok: true, data: { result: true } }), { status: 200 })
  );
  assert.equal(await client.check("tenant-42", "marketing"), true);
});

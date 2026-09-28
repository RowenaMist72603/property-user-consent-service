import { InfraiConsentClient } from "./infrai_consent.ts";
import { decidePropertyAccess } from "./property_access.ts";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the example");

const userId = process.env.PROPERTY_USER_ID;
if (!userId) throw new Error("Set PROPERTY_USER_ID before running the example");

const consent = new InfraiConsentClient(apiKey);
const category = "marketing";
await consent.grant(userId, category, `lesson-grant-${userId}-${category}`);
try {
  const decision = await decidePropertyAccess(consent, userId, {
    kind: "schedule_inspection_reminder",
    inspectionDate: "2027-01-15T09:00:00.000Z",
  });
  console.log(decision);
} finally {
  await consent.revoke(userId, category, `lesson-revoke-${userId}-${category}`);
}

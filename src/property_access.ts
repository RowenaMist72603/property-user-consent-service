import type { ConsentCategory, ConsentGateway } from "./infrai_consent.ts";

export type PropertyAction =
  | { kind: "submit_maintenance_request"; summary: string }
  | { kind: "share_tenant_document"; documentId: string }
  | { kind: "schedule_inspection_reminder"; inspectionDate: string };

export type AccessDecision =
  | { allowed: true; category: ConsentCategory; next: "dispatch" }
  | { allowed: false; category: ConsentCategory; next: "request_consent" };

export function categoryFor(action: PropertyAction): ConsentCategory {
  switch (action.kind) {
    case "submit_maintenance_request": return "essential";
    case "share_tenant_document": return "third_party";
    case "schedule_inspection_reminder": return "marketing";
  }
}

export async function decidePropertyAccess(
  consent: Pick<ConsentGateway, "check">,
  userId: string,
  action: PropertyAction,
): Promise<AccessDecision> {
  const category = categoryFor(action);
  const allowed = await consent.check(userId, category);
  return allowed
    ? { allowed: true, category, next: "dispatch" }
    : { allowed: false, category, next: "request_consent" };
}

import { createServer, type ServerResponse } from "node:http";
import { z } from "zod";
import { InfraiConsentClient, InfraiError } from "./infrai_consent.ts";
import { decidePropertyAccess } from "./property_access.ts";

const categorySchema = z.enum(["essential", "third_party", "marketing"]);
const consentChangeSchema = z.object({
  userId: z.string().min(1),
  category: categorySchema,
  idempotencyKey: z.string().min(8),
}).strict();
const actionSchema = z.object({
  userId: z.string().min(1),
  action: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("submit_maintenance_request"), summary: z.string().min(1) }).strict(),
    z.object({ kind: z.literal("share_tenant_document"), documentId: z.string().min(1) }).strict(),
    z.object({ kind: z.literal("schedule_inspection_reminder"), inspectionDate: z.string().datetime() }).strict(),
  ]),
}).strict();

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");
const consent = new InfraiConsentClient(apiKey);

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

createServer(async (request, response) => {
  try {
    if (request.method !== "POST") return send(response, 405, { error: "method_not_allowed" });
    const body = await readJson(request);
    if (request.url === "/consent/grant") {
      const input = consentChangeSchema.parse(body);
      await consent.grant(input.userId, input.category, input.idempotencyKey);
      return send(response, 200, { status: "granted", category: input.category });
    }
    if (request.url === "/consent/revoke") {
      const input = consentChangeSchema.parse(body);
      await consent.revoke(input.userId, input.category, input.idempotencyKey);
      return send(response, 200, { status: "revoked", category: input.category });
    }
    if (request.url === "/property-actions/decide") {
      const input = actionSchema.parse(body);
      return send(response, 200, await decidePropertyAccess(consent, input.userId, input.action));
    }
    return send(response, 404, { error: "route_not_found" });
  } catch (error) {
    if (error instanceof z.ZodError) return send(response, 400, { error: "invalid_request", issues: error.issues });
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return send(response, status, { error: error.code, message: error.message });
    }
    return send(response, 502, { error: "upstream_transport_error" });
  }
}).listen(Number(process.env.PORT ?? 3000), () => {
  console.log(`Property consent service listening on http://localhost:${process.env.PORT ?? 3000}`);
});

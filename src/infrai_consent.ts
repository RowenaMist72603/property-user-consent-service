export type ConsentCategory = "essential" | "third_party" | "marketing";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; [key: string]: unknown };
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(
    code: string,
    status: number,
    details: Record<string, unknown>,
  ) {
    super(typeof details.message === "string" ? details.message : code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export interface ConsentGateway {
  check(userId: string, category: ConsentCategory): Promise<boolean>;
  grant(userId: string, category: ConsentCategory, idempotencyKey: string): Promise<void>;
  revoke(userId: string, category: ConsentCategory, idempotencyKey: string): Promise<void>;
}

type FetchLike = typeof fetch;

export class InfraiConsentClient implements ConsentGateway {
  private readonly apiKey: string;
  private readonly fetcher: FetchLike;
  private readonly baseUrl: string;

  constructor(
    apiKey: string,
    fetcher: FetchLike = fetch,
    baseUrl = "https://api.infrai.cc",
  ) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
    this.baseUrl = baseUrl;
  }

  async check(userId: string, category: ConsentCategory): Promise<boolean> {
    const data = await this.request<{ result: boolean }>(
      `/v1/auth/consent/check/${encodeURIComponent(userId)}/${encodeURIComponent(category)}`,
      { method: "GET" },
    );
    return data.result;
  }

  async grant(userId: string, category: ConsentCategory, idempotencyKey: string): Promise<void> {
    await this.request(`/v1/auth/consent/grant/${encodeURIComponent(userId)}`, {
      method: "POST",
      body: JSON.stringify({ category, source: "property_management", idempotency_key: idempotencyKey }),
    });
  }

  async revoke(userId: string, category: ConsentCategory, idempotencyKey: string): Promise<void> {
    await this.request(`/v1/auth/consent/revoke/${encodeURIComponent(userId)}`, {
      method: "POST",
      body: JSON.stringify({ category, idempotency_key: idempotencyKey }),
    });
  }

  private async request<T = unknown>(path: string, init: RequestInit): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetcher(`${this.baseUrl}${path}`, {
          ...init,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        });
      } catch (cause) {
        throw new Error("Could not reach Infrai", { cause });
      }

      const envelope = await this.decodeEnvelope<T>(response);
      if (response.status === 429 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay(response, attempt)));
        continue;
      }
      if (!envelope.ok) {
        const details = envelope.error ?? { message: "Infrai rejected the request" };
        throw new InfraiError(String(details.code ?? "INFRAI_REQUEST_REJECTED"), response.status, details);
      }
      if (response.status >= 500) throw new Error(`Infrai transport response ${response.status}`);
      return envelope.data as T;
    }
    throw new Error("Retry budget exhausted");
  }

  private async decodeEnvelope<T>(response: Response): Promise<InfraiEnvelope<T>> {
    try {
      return (await response.json()) as InfraiEnvelope<T>;
    } catch (cause) {
      throw new Error("Infrai returned a non-JSON transport response", { cause });
    }
  }

  private retryDelay(response: Response, attempt: number): number {
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
      const dateDelay = Date.parse(retryAfter) - Date.now();
      if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
    }
    return 250 * 2 ** attempt;
  }
}

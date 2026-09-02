import { describe, expect, it, vi } from "vitest";
import { createClockSkewRetryFetch } from "../src/lib/supabase-clock-skew";

function futureJwtResponse() {
  return new Response(JSON.stringify({
    code: "PGRST303",
    message: "JWT issued at future",
  }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

describe("Supabase clock-skew retry", () => {
  it("retries the temporary future-JWT rejection and returns the successful response", async () => {
    const fetchImplementation = vi.fn()
      .mockResolvedValueOnce(futureJwtResponse())
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const retryingFetch = createClockSkewRetryFetch(fetchImplementation, sleep, [1]);

    const response = await retryingFetch("https://example.test/projects");

    expect(response.status).toBe(200);
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1);
  });

  it("does not retry unrelated authentication failures", async () => {
    const response = new Response(JSON.stringify({
      code: "PGRST301",
      message: "JWT expired",
    }), { status: 401 });
    const fetchImplementation = vi.fn().mockResolvedValue(response);
    const sleep = vi.fn().mockResolvedValue(undefined);
    const retryingFetch = createClockSkewRetryFetch(fetchImplementation, sleep, [1]);

    const result = await retryingFetch("https://example.test/projects");

    expect(result).toBe(response);
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});

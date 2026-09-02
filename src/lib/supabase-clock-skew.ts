type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];
type Sleep = (milliseconds: number) => Promise<void>;

const RETRY_DELAYS_MS = [1_000, 3_000] as const;

async function isFutureJwtRejection(response: Response) {
  if (response.status !== 401) return false;

  try {
    const body = await response.clone().json() as { code?: string; message?: string };
    return body.code === "PGRST303" && body.message === "JWT issued at future";
  } catch {
    return false;
  }
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

export function createClockSkewRetryFetch(
  fetchImplementation: typeof fetch = fetch,
  sleep: Sleep = wait,
  retryDelays: readonly number[] = RETRY_DELAYS_MS,
): typeof fetch {
  return async (input: FetchInput, init?: FetchInit) => {
    for (let attempt = 0; ; attempt += 1) {
      const reusableInput = input instanceof Request ? input.clone() : input;
      const response = await fetchImplementation(reusableInput, init);

      if (!(await isFutureJwtRejection(response)) || attempt >= retryDelays.length) {
        return response;
      }

      console.warn("[supabase-admin] Retrying after a temporary JWT clock-skew rejection", {
        attempt: attempt + 1,
      });
      await sleep(retryDelays[attempt]);
    }
  };
}

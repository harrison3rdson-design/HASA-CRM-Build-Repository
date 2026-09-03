const MAX_PUBLIC_JSON_BYTES = 8 * 1024;
const PUBLIC_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export class PublicRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "PublicRequestError";
  }
}

export type PublicAcceptanceInput = {
  signerName: string;
  signerTitle: string | null;
  signerEmail: string | null;
  signerMobile: string | null;
  signatureType: "typed";
  acceptanceStatement: string;
};

function stringField(
  record: Record<string, unknown>,
  key: string,
  label: string,
  maxLength: number,
  required = false
): string | null {
  const value = typeof record[key] === "string" ? record[key].trim() : "";
  if (required && !value) throw new PublicRequestError(`${label} is required.`, 400);
  if (value.length > maxLength) throw new PublicRequestError(`${label} is too long.`, 400);
  return value || null;
}

async function readLimitedBody(request: Request): Promise<string> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new PublicRequestError("This request must contain JSON.", 415);
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength) {
    const bytes = Number(declaredLength);
    if (!Number.isFinite(bytes) || bytes < 0) {
      throw new PublicRequestError("The request size is invalid.", 400);
    }
    if (bytes > MAX_PUBLIC_JSON_BYTES) {
      throw new PublicRequestError("The request is too large.", 413);
    }
  }

  if (!request.body) throw new PublicRequestError("The request body is required.", 400);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytesRead = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    if (bytesRead > MAX_PUBLIC_JSON_BYTES) {
      await reader.cancel();
      throw new PublicRequestError("The request is too large.", 413);
    }
    chunks.push(value);
  }

  const body = new Uint8Array(bytesRead);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(body);
}

export function validatePublicToken(token: string): string {
  if (!PUBLIC_TOKEN_PATTERN.test(token)) {
    throw new PublicRequestError("This document link is invalid.", 404);
  }
  return token;
}

export function rejectCrossSiteSubmission(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") {
    throw new PublicRequestError("Cross-site document approval is not permitted.", 403);
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new PublicRequestError("Cross-site document approval is not permitted.", 403);
  }
}

export async function readPublicAcceptance(request: Request): Promise<PublicAcceptanceInput> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readLimitedBody(request));
  } catch (error) {
    if (error instanceof PublicRequestError) throw error;
    throw new PublicRequestError("The request contains invalid JSON.", 400);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new PublicRequestError("The acceptance information is invalid.", 400);
  }

  const record = parsed as Record<string, unknown>;
  const signerName = stringField(record, "signerName", "Signer name", 120, true)!;
  const signerTitle = stringField(record, "signerTitle", "Signer title", 120);
  const signerEmail = stringField(record, "signerEmail", "Signer email", 254);
  const signerMobile = stringField(record, "signerMobile", "Signer mobile number", 40);

  if (signerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signerEmail)) {
    throw new PublicRequestError("Enter a valid signer email address.", 400);
  }

  return {
    signerName,
    signerTitle,
    signerEmail,
    signerMobile,
    signatureType: "typed",
    acceptanceStatement: "I accept and authorize this document.",
  };
}

export function publicRequestErrorResponse(error: unknown): Response | null {
  if (!(error instanceof PublicRequestError)) return null;
  return Response.json({ error: error.message }, { status: error.status });
}

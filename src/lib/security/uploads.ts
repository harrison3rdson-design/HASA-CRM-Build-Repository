const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SAFE_UPLOAD_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function startsWith(bytes: Uint8Array, expected: number[]) {
  return expected.every((value, index) => bytes[index] === value);
}

function hasExpectedSignature(type: string, bytes: Uint8Array) {
  if (type === "application/pdf") return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  if (type === "image/jpeg") return startsWith(bytes, [0xff, 0xd8, 0xff]);
  if (type === "image/png") return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (type === "image/webp") {
    return startsWith(bytes, [0x52, 0x49, 0x46, 0x46])
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  }
  return false;
}

export function requiredUuid(value: FormDataEntryValue | null, field: string) {
  const id = String(value ?? "").trim();
  if (!UUID_PATTERN.test(id)) throw new Error(field + " is invalid.");
  return id;
}

export async function validateUploadedFile(file: File, label: string, maxBytes: number) {
  if (!file.name || file.size <= 0) throw new Error(label + " is empty.");
  if (file.size > maxBytes) {
    throw new Error(label + " exceeds " + Math.floor(maxBytes / 1024 / 1024) + " MB.");
  }
  if (!SAFE_UPLOAD_TYPES.has(file.type)) {
    throw new Error(label + " must be a PDF, JPEG, PNG, or WebP file.");
  }

  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!hasExpectedSignature(file.type, header)) {
    throw new Error(label + " contents do not match its stated file type.");
  }
}

export function safeOriginalFilename(filename: string) {
  const normalized = filename.normalize("NFKC").replace(/[^a-zA-Z0-9._-]/g, "_");
  return normalized.slice(-180) || "upload";
}

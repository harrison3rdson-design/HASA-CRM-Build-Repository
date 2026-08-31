import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/server";
import {
  createSignedDocumentUrl,
  createSignedReceiptUrl,
} from "@/lib/storage/private-storage";

export async function POST(request: NextRequest) {
  await requireUser();
  const { bucketType, path, expiresIn } = await request.json();

  if (!path || !["document", "receipt"].includes(bucketType)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const url =
    bucketType === "receipt"
      ? await createSignedReceiptUrl(path, expiresIn ?? 900)
      : await createSignedDocumentUrl(path, expiresIn ?? 900);

  return NextResponse.json({ url });
}

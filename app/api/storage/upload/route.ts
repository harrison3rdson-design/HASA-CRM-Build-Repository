import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/server";

export async function POST(request: NextRequest) {
  await requireUser();

  const formData = await request.formData();
  const file = formData.get("file");
  const destinationPath = formData.get("destinationPath");
  const bucketType = formData.get("bucketType");

  if (!(file instanceof File) || typeof destinationPath !== "string") {
    return NextResponse.json({ error: "file and destinationPath are required" }, { status: 400 });
  }

  // Production implementation should validate:
  // - MIME type
  // - file size
  // - destination ownership / project access
  // - allowed bucket
  // and then upload via server-side Supabase Storage.
  return NextResponse.json(
    {
      status: "scaffold",
      filename: file.name,
      size: file.size,
      bucketType,
      destinationPath,
    },
    { status: 501 }
  );
}

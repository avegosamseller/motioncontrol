import { NextRequest, NextResponse } from "next/server";

// Allow large file uploads
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file size (max 200MB for catbox)
    if (file.size > 200 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 200MB." },
        { status: 400 }
      );
    }

    // Convert File to Buffer for upload
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create a Blob from the buffer to upload to catbox
    const blob = new Blob([buffer], { type: file.type });

    // Upload to catbox.moe
    const catboxForm = new FormData();
    catboxForm.append("reqtype", "fileupload");
    catboxForm.append("fileToUpload", blob, file.name);

    const response = await fetch("https://catbox.moe/user/api.php", {
      method: "POST",
      body: catboxForm,
    });

    const responseText = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upload failed (${response.status}): ${responseText || response.statusText}` },
        { status: response.status }
      );
    }

    // Catbox returns the URL directly as plain text
    const url = responseText.trim();
    if (!url.startsWith("https://")) {
      return NextResponse.json(
        { error: `Unexpected response from hosting service: ${url}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

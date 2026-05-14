import { NextRequest, NextResponse } from "next/server";

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

    // Upload to catbox.moe
    const catboxForm = new FormData();
    catboxForm.append("reqtype", "fileupload");
    catboxForm.append("fileToUpload", file);

    const response = await fetch("https://catbox.moe/user/api.php", {
      method: "POST",
      body: catboxForm,
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `Upload failed: ${text || response.statusText}` },
        { status: response.status }
      );
    }

    const url = await response.text();

    // Catbox returns the URL directly as plain text
    if (!url || !url.startsWith("https://")) {
      return NextResponse.json(
        { error: `Unexpected response from hosting service: ${url}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: url.trim() });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};

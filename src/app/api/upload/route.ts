import { NextRequest, NextResponse } from "next/server";

// Force dynamic rendering and Node.js runtime
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Increase body size limit for this route (Vercel Pro: up to 100MB, Free: 4.5MB)
export const fetchCache = "force-no-store";

export async function POST(request: NextRequest) {
  try {
    const contentLength = request.headers.get("content-length");
    const sizeInMB = contentLength ? parseInt(contentLength) / (1024 * 1024) : 0;

    // Warn if file might be too large for Vercel free tier
    if (sizeInMB > 4) {
      return NextResponse.json(
        { error: `File too large (${sizeInMB.toFixed(1)}MB). Vercel free tier supports up to ~4MB uploads. Please use a smaller file or paste a public URL instead.` },
        { status: 413 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Convert File to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const blob = new Blob([buffer], { type: file.type });

    // Upload to catbox.moe
    const catboxForm = new FormData();
    catboxForm.append("reqtype", "fileupload");
    catboxForm.append("fileToUpload", blob, file.name || "upload");

    const response = await fetch("https://catbox.moe/user/api.php", {
      method: "POST",
      body: catboxForm,
    });

    const responseText = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        { error: `Catbox upload failed (${response.status}): ${responseText.substring(0, 200)}` },
        { status: response.status }
      );
    }

    // Catbox returns the URL directly as plain text
    const url = responseText.trim();
    if (!url.startsWith("https://")) {
      return NextResponse.json(
        { error: `Unexpected response from catbox: ${url.substring(0, 200)}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Upload failed";
    
    // Check if it's a body size error
    if (message.includes("body") || message.includes("size") || message.includes("limit")) {
      return NextResponse.json(
        { error: "File too large for server upload. Please use a file under 4MB, or paste a public URL directly." },
        { status: 413 }
      );
    }
    
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

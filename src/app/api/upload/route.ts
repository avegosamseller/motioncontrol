import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
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

    // Check file size (Vercel free tier limit ~4.5MB)
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Max 4MB on Vercel free tier. Please paste a public URL instead." },
        { status: 413 }
      );
    }

    // Convert File to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const blob = new Blob([buffer], { type: file.type });

    // Try 0x0.st first (simple file host)
    try {
      const form0x0 = new FormData();
      form0x0.append("file", blob, file.name || "upload");

      const res0x0 = await fetch("https://0x0.st", {
        method: "POST",
        body: form0x0,
      });

      if (res0x0.ok) {
        const url = (await res0x0.text()).trim();
        if (url.startsWith("http")) {
          return NextResponse.json({ url });
        }
      }
    } catch {
      // fallback
    }

    // Fallback: catbox.moe
    try {
      const catboxForm = new FormData();
      catboxForm.append("reqtype", "fileupload");
      catboxForm.append("fileToUpload", blob, file.name || "upload");

      const resCatbox = await fetch("https://catbox.moe/user/api.php", {
        method: "POST",
        body: catboxForm,
      });

      const catboxText = (await resCatbox.text()).trim();
      if (resCatbox.ok && catboxText.startsWith("https://")) {
        return NextResponse.json({ url: catboxText });
      }
    } catch {
      // fallback
    }

    // Fallback: litterbox.catbox.moe (temporary 72h)
    try {
      const litterForm = new FormData();
      litterForm.append("reqtype", "fileupload");
      litterForm.append("time", "72h");
      litterForm.append("fileToUpload", blob, file.name || "upload");

      const resLitter = await fetch("https://litterbox.catbox.moe/resources/internals/api.php", {
        method: "POST",
        body: litterForm,
      });

      const litterText = (await resLitter.text()).trim();
      if (resLitter.ok && litterText.startsWith("https://")) {
        return NextResponse.json({ url: litterText });
      }
    } catch {
      // all failed
    }

    return NextResponse.json(
      { error: "All upload services failed. Please paste a public URL directly." },
      { status: 500 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

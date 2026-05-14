import { NextRequest, NextResponse } from "next/server";

const MODEL_ENDPOINTS: Record<string, string> = {
  "kling-2.6-standard": "https://api.magnific.com/v1/ai/video/kling-v2-6-motion-control-std",
  "kling-2.6-pro": "https://api.magnific.com/v1/ai/video/kling-v2-6-motion-control-pro",
  "kling-3.0-standard": "https://api.magnific.com/v1/ai/video/kling-v3-motion-control-std",
  "kling-3.0-pro": "https://api.magnific.com/v1/ai/video/kling-v3-motion-control-pro",
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { model, imageUrl, videoUrl, prompt, cfgScale, apiKey } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: "API Key is required" },
        { status: 400 }
      );
    }

    if (!model || !MODEL_ENDPOINTS[model]) {
      return NextResponse.json(
        { error: "Invalid model selected" },
        { status: 400 }
      );
    }

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Reference image is required" },
        { status: 400 }
      );
    }

    if (!videoUrl) {
      return NextResponse.json(
        { error: "Reference video is required" },
        { status: 400 }
      );
    }

    const endpoint = MODEL_ENDPOINTS[model];

    const payload: Record<string, unknown> = {
      image_url: imageUrl,
      video_url: videoUrl,
    };

    if (prompt && prompt.trim()) {
      payload.prompt = prompt.trim();
    }

    if (cfgScale !== undefined && cfgScale !== null) {
      payload.cfg_scale = parseFloat(cfgScale);
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-magnific-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || data.error || "API request failed", details: data },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

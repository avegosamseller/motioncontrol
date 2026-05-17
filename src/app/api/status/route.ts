import { NextRequest, NextResponse } from "next/server";

const MODEL_TASK_ENDPOINTS: Record<string, string> = {
  "kling-2.6-standard": "https://api.freepik.com/v1/ai/image-to-video/kling-v2-6",
  "kling-2.6-pro": "https://api.freepik.com/v1/ai/image-to-video/kling-v2-6",
  "kling-3.0-standard": "https://api.freepik.com/v1/ai/video/kling-v3-motion-control-std",
  "kling-3.0-pro": "https://api.freepik.com/v1/ai/video/kling-v3-motion-control-pro",
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const taskId = searchParams.get("taskId");
    const model = searchParams.get("model");
    const apiKey = searchParams.get("apiKey");

    if (!taskId || !model || !apiKey) {
      return NextResponse.json(
        { error: "taskId, model, and apiKey are required" },
        { status: 400 }
      );
    }

    const baseEndpoint = MODEL_TASK_ENDPOINTS[model];
    if (!baseEndpoint) {
      return NextResponse.json(
        { error: "Invalid model" },
        { status: 400 }
      );
    }

    const endpoint = `${baseEndpoint}/${taskId}`;

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "x-freepik-api-key": apiKey,
      },
    });

    // Handle non-JSON responses gracefully
    const contentType = response.headers.get("content-type") || "";
    let data;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      if (!response.ok) {
        return NextResponse.json(
          { error: `API returned an error (${response.status}): ${text}` },
          { status: response.status }
        );
      }
      try {
        data = JSON.parse(text);
      } catch {
        return NextResponse.json(
          { error: `Unexpected API response: ${text.substring(0, 200)}` },
          { status: 500 }
        );
      }
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || data.error || "Failed to get task status", details: data },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

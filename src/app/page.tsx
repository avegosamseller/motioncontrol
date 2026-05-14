"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type TaskStatus = "idle" | "submitting" | "processing" | "completed" | "failed";

interface TaskResult {
  id?: string;
  status?: string;
  video_url?: string;
  video?: { url: string }[];
  data?: {
    id?: string;
    status?: string;
    video_url?: string;
    video?: { url: string }[];
    output?: { video_url?: string };
  };
}

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("kling-2.6-standard");
  const [prompt, setPrompt] = useState("");
  const [cfgScale, setCfgScale] = useState(0.5);
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<TaskStatus>("idle");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setImagePreview(base64);
        setImageUrl(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setVideoPreview(base64);
        setVideoUrl(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const extractVideoUrl = (result: TaskResult): string | null => {
    if (result.video_url) return result.video_url;
    if (result.video && result.video.length > 0) return result.video[0].url;
    if (result.data) {
      if (result.data.video_url) return result.data.video_url;
      if (result.data.video && result.data.video.length > 0) return result.data.video[0].url;
      if (result.data.output?.video_url) return result.data.output.video_url;
    }
    return null;
  };

  const checkStatus = useCallback(async () => {
    if (!taskId || !apiKey) return;

    try {
      const params = new URLSearchParams({
        taskId,
        model,
        apiKey,
      });

      const response = await fetch(`/api/status?${params}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to check status");
        setTaskStatus("failed");
        if (pollingRef.current) clearInterval(pollingRef.current);
        return;
      }

      const status = data.data?.status || data.status || "";
      setStatusMessage(`Status: ${status}`);

      if (status === "completed" || status === "succeed" || status === "done") {
        const videoResultUrl = extractVideoUrl(data);
        if (videoResultUrl) {
          setResultVideoUrl(videoResultUrl);
          setTaskStatus("completed");
        } else {
          setError("Video completed but no URL found in response");
          setTaskStatus("failed");
        }
        if (pollingRef.current) clearInterval(pollingRef.current);
      } else if (status === "failed" || status === "error") {
        setError(data.data?.error || data.error || "Generation failed");
        setTaskStatus("failed");
        if (pollingRef.current) clearInterval(pollingRef.current);
      }
    } catch (err) {
      console.error("Status check error:", err);
    }
  }, [taskId, model, apiKey]);

  useEffect(() => {
    if (taskStatus === "processing" && taskId) {
      pollingRef.current = setInterval(checkStatus, 5000);
      return () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
      };
    }
  }, [taskStatus, taskId, checkStatus]);

  const handleSubmit = async () => {
    setError(null);
    setResultVideoUrl(null);
    setStatusMessage("");

    if (!apiKey) {
      setError("Please enter your Magnific API Key");
      return;
    }
    if (!imageUrl) {
      setError("Please upload a reference image or provide an image URL");
      return;
    }
    if (!videoUrl) {
      setError("Please upload a reference video or provide a video URL");
      return;
    }

    setTaskStatus("submitting");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          imageUrl,
          videoUrl,
          prompt,
          cfgScale,
          apiKey,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to submit generation request");
        setTaskStatus("failed");
        return;
      }

      const id = data.data?.id || data.id || data.task_id;
      if (id) {
        setTaskId(id);
        setTaskStatus("processing");
        setStatusMessage("Task submitted. Waiting for processing...");
      } else {
        // Maybe the response already contains the video
        const videoResultUrl = extractVideoUrl(data);
        if (videoResultUrl) {
          setResultVideoUrl(videoResultUrl);
          setTaskStatus("completed");
        } else {
          setError("No task ID returned from API");
          setTaskStatus("failed");
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      setError(message);
      setTaskStatus("failed");
    }
  };

  const resetForm = () => {
    setTaskStatus("idle");
    setTaskId(null);
    setResultVideoUrl(null);
    setError(null);
    setStatusMessage("");
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            🎬 Motion Control Generator
          </h1>
          <p className="text-gray-400">
            Generate motion control videos using Kling AI via Magnific API
          </p>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6 md:p-8 space-y-6">
          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Magnific API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Magnific API key..."
              className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Get your API key from{" "}
              <a href="https://magnific.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                magnific.com
              </a>
            </p>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="kling-2.6-standard">Kling 2.6 Standard</option>
              <option value="kling-2.6-pro">Kling 2.6 Pro</option>
              <option value="kling-3.0-standard">Kling 3.0 Standard</option>
              <option value="kling-3.0-pro">Kling 3.0 Pro</option>
            </select>
          </div>

          {/* Upload Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Reference Image */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Reference Image (Character)
              </label>
              <div
                onClick={() => imageInputRef.current?.click()}
                className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center cursor-pointer hover:border-blue-500 transition-colors min-h-[200px] flex items-center justify-center"
              >
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Reference"
                    className="max-h-[180px] max-w-full object-contain rounded"
                  />
                ) : (
                  <div className="text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm">Click to upload image</p>
                    <p className="text-xs mt-1">or paste URL below</p>
                  </div>
                )}
              </div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <input
                type="text"
                value={imageUrl.startsWith("data:") ? "" : imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setImagePreview(e.target.value || null);
                }}
                placeholder="Or paste image URL..."
                className="w-full mt-2 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Reference Video */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Reference Video (Motion Source)
              </label>
              <div
                onClick={() => videoInputRef.current?.click()}
                className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center cursor-pointer hover:border-blue-500 transition-colors min-h-[200px] flex items-center justify-center"
              >
                {videoPreview ? (
                  <video
                    src={videoPreview}
                    className="max-h-[180px] max-w-full object-contain rounded"
                    controls
                    muted
                  />
                ) : (
                  <div className="text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm">Click to upload video</p>
                    <p className="text-xs mt-1">or paste URL below</p>
                  </div>
                )}
              </div>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                className="hidden"
              />
              <input
                type="text"
                value={videoUrl.startsWith("data:") ? "" : videoUrl}
                onChange={(e) => {
                  setVideoUrl(e.target.value);
                  setVideoPreview(e.target.value || null);
                }}
                placeholder="Or paste video URL..."
                className="w-full mt-2 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Prompt (Optional)
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the desired motion or style..."
              rows={3}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* CFG Scale */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              CFG Scale: <span className="text-blue-400">{cfgScale.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={cfgScale}
              onChange={(e) => setCfgScale(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0 (More creative)</span>
              <span>1 (More faithful)</span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Status Message */}
          {statusMessage && taskStatus === "processing" && (
            <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 text-blue-300 text-sm flex items-center gap-3">
              <svg className="animate-spin h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {statusMessage}
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={taskStatus === "completed" || taskStatus === "failed" ? resetForm : handleSubmit}
            disabled={taskStatus === "submitting" || taskStatus === "processing"}
            className={`w-full py-4 rounded-lg font-semibold text-lg transition-all ${
              taskStatus === "submitting" || taskStatus === "processing"
                ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                : taskStatus === "completed" || taskStatus === "failed"
                ? "bg-yellow-600 hover:bg-yellow-500 text-white"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30"
            }`}
          >
            {taskStatus === "submitting"
              ? "Submitting..."
              : taskStatus === "processing"
              ? "Generating Video..."
              : taskStatus === "completed" || taskStatus === "failed"
              ? "Generate Another"
              : "Generate Video"}
          </button>

          {/* Result */}
          {resultVideoUrl && taskStatus === "completed" && (
            <div className="mt-6 bg-green-900/20 border border-green-700 rounded-lg p-6">
              <h3 className="text-green-300 font-semibold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Video Generated Successfully!
              </h3>
              <video
                src={resultVideoUrl}
                controls
                autoPlay
                loop
                className="w-full rounded-lg max-h-[500px] object-contain bg-black"
              />
              <a
                href={resultVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Video
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-6">
          Powered by Magnific API &middot; Kling AI Motion Control
        </p>
      </div>
    </main>
  );
}

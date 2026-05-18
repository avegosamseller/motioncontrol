"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type TaskStatus = "idle" | "submitting" | "processing" | "completed" | "failed";
type UploadStatus = "idle" | "uploading" | "done" | "error";

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("kling-2.6-standard");
  const [prompt, setPrompt] = useState("");
  const [cfgScale, setCfgScale] = useState(0.5);
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [imageUploadStatus, setImageUploadStatus] = useState<UploadStatus>("idle");
  const [videoUploadStatus, setVideoUploadStatus] = useState<UploadStatus>("idle");
  const [taskStatus, setTaskStatus] = useState<TaskStatus>("idle");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Upload failed");
    return data.url;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    setImageUploadStatus("uploading");
    setError(null);
    try {
      const url = await uploadFile(file);
      setImageUrl(url);
      setImageUploadStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed");
      setImageUploadStatus("error");
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setVideoPreview(reader.result as string);
    reader.readAsDataURL(file);
    setVideoUploadStatus("uploading");
    setError(null);
    try {
      const url = await uploadFile(file);
      setVideoUrl(url);
      setVideoUploadStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video upload failed");
      setVideoUploadStatus("error");
    }
  };

  const checkStatus = useCallback(async () => {
    if (!taskId || !apiKey) return;
    try {
      const params = new URLSearchParams({ taskId, model, apiKey });
      const response = await fetch(`/api/status?${params}`);
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to check status");
        setTaskStatus("failed");
        if (pollingRef.current) clearInterval(pollingRef.current);
        return;
      }
      const status = (data.data?.status || data.status || "").toLowerCase();
      setStatusMessage(`${status}`);
      if (status === "completed" || status === "succeed" || status === "done") {
        let videoResult = null;
        if (data.data?.generated?.length > 0) videoResult = data.data.generated[0];
        else if (data.generated?.length > 0) videoResult = data.generated[0];
        else if (data.data?.video_url) videoResult = data.data.video_url;
        else if (data.video_url) videoResult = data.video_url;
        if (videoResult) {
          setResultVideoUrl(videoResult);
          setTaskStatus("completed");
        } else {
          setError("Completed but no video URL found");
          setTaskStatus("failed");
        }
        if (pollingRef.current) clearInterval(pollingRef.current);
      } else if (status === "failed" || status === "error") {
        const d = data.data || {};
        setError(d.error || d.message || data.error || `Generation failed. Response: ${JSON.stringify(data).substring(0, 200)}`);
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
      return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
    }
  }, [taskStatus, taskId, checkStatus]);

  const handleSubmit = async () => {
    setError(null);
    setResultVideoUrl(null);
    setStatusMessage("");
    if (!apiKey) { setError("Masukkan API Key terlebih dahulu"); return; }
    if (!imageUrl) { setError("Upload gambar referensi terlebih dahulu"); return; }
    if (!videoUrl) { setError("Upload video motion terlebih dahulu"); return; }
    if (!imageUrl.startsWith("http")) { setError("Image URL harus berupa URL publik (https://...)"); return; }
    if (!videoUrl.startsWith("http")) { setError("Video URL harus berupa URL publik (https://...)"); return; }
    setTaskStatus("submitting");
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, imageUrl, videoUrl, prompt, cfgScale, apiKey }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "Generate gagal"); setTaskStatus("failed"); return; }
      const id = data.data?.id || data.data?.task_id || data.id || data.task_id || data.taskId;
      if (id) {
        setTaskId(id);
        setTaskStatus("processing");
        setStatusMessage("processing");
      } else {
        if (data.data?.generated?.length > 0) {
          setResultVideoUrl(data.data.generated[0]);
          setTaskStatus("completed");
        } else {
          setError(`No task ID. Response: ${JSON.stringify(data).substring(0, 200)}`);
          setTaskStatus("failed");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setTaskStatus("failed");
    }
  };

  const resetForm = () => {
    setTaskStatus("idle"); setTaskId(null); setResultVideoUrl(null);
    setError(null); setStatusMessage("");
  };

  const isUploading = imageUploadStatus === "uploading" || videoUploadStatus === "uploading";
  const isBusy = taskStatus === "submitting" || taskStatus === "processing" || isUploading;

  return (
    <div className="min-h-screen bg-[#0a0e1a] relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px]" />
        <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] bg-pink-500/10 rounded-full blur-[100px]" />
      </div>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`fixed top-0 left-0 h-full w-80 z-50 transform transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="h-full bg-white/5 backdrop-blur-xl border-r border-white/10 p-6 flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-white font-bold text-lg">Pengaturan</h2>
            <button onClick={() => setSidebarOpen(false)} className="text-white/60 hover:text-white text-2xl">&times;</button>
          </div>

          {/* API Key */}
          <div className="mb-6">
            <label className="text-white/70 text-xs font-medium uppercase tracking-wider mb-2 block">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="FPSX..."
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all"
            />
            <p className="text-white/30 text-xs mt-1.5">Dari <a href="https://magnific.com" target="_blank" className="text-purple-400 hover:underline">magnific.com</a></p>
          </div>

          {/* Model */}
          <div className="mb-6">
            <label className="text-white/70 text-xs font-medium uppercase tracking-wider mb-2 block">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500/50 transition-all"
            >
              <option value="kling-2.6-standard">Kling 2.6 Standard</option>
              <option value="kling-2.6-pro">Kling 2.6 Pro</option>
              <option value="kling-3.0-standard">Kling 3.0 Standard</option>
              <option value="kling-3.0-pro">Kling 3.0 Pro</option>
            </select>
          </div>

          {/* CFG Scale */}
          <div className="mb-6">
            <label className="text-white/70 text-xs font-medium uppercase tracking-wider mb-2 block">
              CFG Scale: <span className="text-purple-400">{cfgScale.toFixed(2)}</span>
            </label>
            <input
              type="range" min="0" max="1" step="0.01"
              value={cfgScale}
              onChange={(e) => setCfgScale(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500"
            />
            <div className="flex justify-between text-white/30 text-xs mt-1">
              <span>Kreatif</span><span>Faithful</span>
            </div>
          </div>

          {/* Prompt */}
          <div className="mb-6">
            <label className="text-white/70 text-xs font-medium uppercase tracking-wider mb-2 block">Prompt (Opsional)</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Deskripsi gerakan..."
              rows={3}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-purple-500/50 resize-none transition-all"
            />
          </div>

          {/* Telegram Bot Button */}
          <div className="mt-auto">
            <a
              href="https://t.me/avegosell_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-[#2AABEE]/20 border border-[#2AABEE]/30 rounded-xl text-[#2AABEE] font-medium text-sm hover:bg-[#2AABEE]/30 transition-all"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
              Telegram Bot
            </a>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-10 h-10 flex items-center justify-center bg-white/5 backdrop-blur-md border border-white/10 rounded-xl hover:bg-white/10 transition-all"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <div>
              <h1 className="text-white font-bold text-xl tracking-tight">AVEGOSAM STUDIO</h1>
              <p className="text-white/40 text-xs">Motion Control AI</p>
            </div>
          </div>
          <a href="https://avegosam.web.id" target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-white/5 backdrop-blur-md border border-white/10 rounded-lg text-purple-400 text-xs font-medium hover:bg-purple-500/10 hover:border-purple-500/30 transition-all flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              avegosam.web.id
            </a>
        </header>

        {/* Subtitle */}
        <div className="px-6 pb-4">
          <p className="text-white/50 text-sm max-w-lg">
            Buat video motion AI dari gambar karakter dan referensi video. Info lengkap cek di website <a href="https://avegosam.web.id" target="_blank" className="text-purple-400 hover:underline">avegosam.web.id</a>
          </p>
        </div>

        {/* Main Area */}
        <main className="flex-1 px-6 pb-6">
          <div className="grid grid-cols-2 gap-4 max-w-3xl mx-auto">
            {/* Image Card */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all">
                {/* Glass line decoration */}
                <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold text-sm">Gambar Karakter</h3>
                  {imageUploadStatus === "uploading" && <span className="text-yellow-400 text-xs animate-pulse">Uploading...</span>}
                  {imageUploadStatus === "done" && <span className="text-green-400 text-xs">Uploaded</span>}
                  {imageUploadStatus === "error" && <span className="text-red-400 text-xs">Gagal</span>}
                </div>

                <div
                  onClick={() => imageInputRef.current?.click()}
                  className="relative w-full aspect-[4/5] max-h-[280px] rounded-xl overflow-hidden cursor-pointer border border-white/5 hover:border-purple-500/30 transition-all flex items-center justify-center bg-white/[0.02]"
                >
                  {/* Glass line on card */}
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                  {imagePreview ? (
                    <img src={imagePreview} alt="Reference" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-4">
                      <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                        <svg className="w-6 h-6 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V4.5a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v15a1.5 1.5 0 001.5 1.5z" />
                        </svg>
                      </div>
                      <p className="text-white/40 text-sm">Klik untuk upload</p>
                      <p className="text-white/20 text-xs mt-1">JPG, PNG</p>
                    </div>
                  )}
                </div>
                <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </div>
            </div>

            {/* Video Card */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-pink-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all">
                {/* Glass line decoration */}
                <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold text-sm">Video Referensi</h3>
                  {videoUploadStatus === "uploading" && <span className="text-yellow-400 text-xs animate-pulse">Uploading...</span>}
                  {videoUploadStatus === "done" && <span className="text-green-400 text-xs">Uploaded</span>}
                  {videoUploadStatus === "error" && <span className="text-red-400 text-xs">Gagal</span>}
                </div>

                <div
                  onClick={() => videoInputRef.current?.click()}
                  className="relative w-full aspect-[4/5] max-h-[280px] rounded-xl overflow-hidden cursor-pointer border border-white/5 hover:border-blue-500/30 transition-all flex items-center justify-center bg-white/[0.02]"
                >
                  {/* Glass line on card */}
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                  {videoPreview ? (
                    <video src={videoPreview} className="w-full h-full object-cover" controls muted />
                  ) : (
                    <div className="text-center p-4">
                      <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                        <svg className="w-6 h-6 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                      </div>
                      <p className="text-white/40 text-sm">Klik untuk upload</p>
                      <p className="text-white/20 text-xs mt-1">MP4 (2-10 detik)</p>
                    </div>
                  )}
                </div>
                <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="max-w-3xl mx-auto mt-4">
              <div className="bg-red-500/10 backdrop-blur-md border border-red-500/20 rounded-xl px-4 py-3 text-red-300 text-sm">
                {error}
              </div>
            </div>
          )}

          {/* Status */}
          {statusMessage && taskStatus === "processing" && (
            <div className="max-w-3xl mx-auto mt-4">
              <div className="bg-purple-500/10 backdrop-blur-md border border-purple-500/20 rounded-xl px-4 py-3 text-purple-300 text-sm flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                Generating... ({statusMessage})
              </div>
            </div>
          )}

          {/* Generate Button */}
          <div className="max-w-3xl mx-auto mt-5">
            <button
              onClick={taskStatus === "completed" || taskStatus === "failed" ? resetForm : handleSubmit}
              disabled={isBusy}
              className={`w-full py-4 rounded-2xl font-semibold text-base transition-all ${
                isBusy
                  ? "bg-white/5 text-white/30 cursor-not-allowed border border-white/5"
                  : taskStatus === "completed" || taskStatus === "failed"
                  ? "bg-white/10 text-white border border-white/20 hover:bg-white/15"
                  : "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 hover:scale-[1.01]"
              }`}
            >
              {isUploading ? "Mengupload..." : taskStatus === "submitting" ? "Mengirim..." : taskStatus === "processing" ? "Generating..." : taskStatus === "completed" || taskStatus === "failed" ? "Generate Lagi" : "Generate Video"}
            </button>
          </div>

          {/* Result */}
          {resultVideoUrl && taskStatus === "completed" && (
            <div className="max-w-3xl mx-auto mt-5">
              <div className="bg-white/5 backdrop-blur-xl border border-green-500/20 rounded-2xl p-5">
                <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-green-500/30 to-transparent" />
                <h3 className="text-green-400 font-semibold text-sm mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Video Berhasil!
                </h3>
                <video src={resultVideoUrl} controls autoPlay loop className="w-full rounded-xl max-h-[400px] object-contain bg-black/50" />
                <a
                  href={resultVideoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl text-sm hover:bg-green-500/20 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download Video
                </a>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

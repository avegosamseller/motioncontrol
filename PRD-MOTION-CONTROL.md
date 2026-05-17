# PRD: Motion Control Video Generator (Web App)

## Overview

Web application untuk generate video motion control menggunakan Kling AI (2.6 Standard/Pro, 3.0 Standard/Pro) melalui Freepik API. User upload gambar karakter referensi + video sumber gerakan, lalu AI akan mentransfer gerakan dari video ke karakter.

---

## Tech Stack

| Komponen | Teknologi |
|----------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Backend | Next.js API Routes (App Router) |
| Hosting | Vercel / Self-hosted (Nginx + Node.js) |
| File Hosting | Self-hosted via Nginx atau cloud storage (R2, S3, dll) |
| API Provider | Freepik API (`api.freepik.com`) |

---

## API Configuration

### Endpoints

| Model | Generate Endpoint | Status Endpoint |
|-------|------------------|-----------------|
| Kling 2.6 Standard | `POST https://api.freepik.com/v1/ai/video/kling-v2-6-motion-control-std` | `GET https://api.freepik.com/v1/ai/image-to-video/kling-v2-6/{task_id}` |
| Kling 2.6 Pro | `POST https://api.freepik.com/v1/ai/video/kling-v2-6-motion-control-pro` | `GET https://api.freepik.com/v1/ai/image-to-video/kling-v2-6/{task_id}` |
| Kling 3.0 Standard | `POST https://api.freepik.com/v1/ai/video/kling-v3-motion-control-std` | `GET https://api.freepik.com/v1/ai/video/kling-v3-motion-control-std/{task_id}` |
| Kling 3.0 Pro | `POST https://api.freepik.com/v1/ai/video/kling-v3-motion-control-pro` | `GET https://api.freepik.com/v1/ai/video/kling-v3-motion-control-pro/{task_id}` |

### Authentication

- Header: `x-freepik-api-key: <API_KEY>`
- API Key format: `FPSXxxxxxxxxxxxxxxxxxxxxxxxxxx`
- Dapatkan dari: https://magnific.com

### Generate Request Body

```json
{
  "image_url": "https://domain.com/path/to/image.jpg",
  "video_url": "https://domain.com/path/to/video.mp4",
  "character_orientation": "video",
  "prompt": "optional description",
  "cfg_scale": 0.5
}
```

**Catatan penting:** `character_orientation: "video"` wajib disertakan di setiap request.

### Generate Response

```json
{
  "data": {
    "task_id": "uuid-string",
    "status": "PROCESSING"
  }
}
```

### Status Response (Completed)

```json
{
  "data": {
    "task_id": "uuid-string",
    "status": "COMPLETED",
    "generated": [
      "https://cdn-magnific.freepik.com/kling_xxxxx.mp4?token=xxx"
    ]
  }
}
```

### Status Values

| Status | Meaning |
|--------|---------|
| `PROCESSING` | Sedang diproses |
| `COMPLETED` | Selesai, video ready di `generated[0]` |
| `FAILED` | Gagal (credit habis, file tidak valid, dll) |

**Catatan:** Status dari API menggunakan **HURUF BESAR** (`COMPLETED`, `FAILED`, `PROCESSING`). Lakukan `.toLowerCase()` sebelum compare.

---

## Parameters

| Parameter | Type | Required | Range | Description |
|-----------|------|----------|-------|-------------|
| `image_url` | string (URL) | Ya | - | URL publik gambar karakter referensi |
| `video_url` | string (URL) | Ya | - | URL publik video motion source |
| `character_orientation` | string | Ya | `"video"` | Selalu kirim "video" |
| `prompt` | string | Tidak | - | Deskripsi tambahan untuk hasil video |
| `cfg_scale` | float | Tidak | 0.0 - 1.0 | 0 = lebih kreatif, 1 = lebih faithful |

---

## File Requirements

### Image (Reference Character)
- Format: JPG, PNG
- Ukuran minimum: 340px (width atau height)
- Ukuran maksimum: 10MB
- Aspect ratio: 2:5 sampai 5:2
- Harus berupa **URL publik** (accessible dari internet)

### Video (Motion Source)
- Format: MP4
- Durasi: 2-10 detik
- Ukuran maksimum: 10MB
- Harus berupa **URL publik** (accessible dari internet)

---

## Application Flow

### Generate Video Flow

```
1. User masukkan API key
2. User pilih model (Kling 2.6/3.0, Standard/Pro)
3. User upload gambar referensi → dapat URL publik
4. User upload video motion → dapat URL publik
5. User atur CFG scale (slider 0-1) dan prompt (opsional)
6. User klik "Generate Video"
7. Frontend POST ke /api/generate → forward ke api.freepik.com
8. API return task_id
9. Frontend polling GET /api/status?taskId=xxx setiap 5 detik
10. Saat status = "COMPLETED" → ambil URL dari data.generated[0]
11. Tampilkan video preview + download link
12. Stop polling
```

### Upload File Flow

```
1. User pilih file dari device
2. File di-upload ke server via POST /api/upload
3. Server simpan file ke disk dan return URL publik
4. URL otomatis diisi ke form field
```

---

## Web App Features

| Feature | Description |
|---------|-------------|
| API Key Input | Password field, user masukkan API key sendiri |
| Model Selection | Dropdown: Kling 2.6 Std/Pro, 3.0 Std/Pro |
| Image Upload | Upload file + auto-host, atau paste URL manual |
| Video Upload | Upload file + auto-host, atau paste URL manual |
| Upload Status Badge | Menampilkan: Uploading... / Uploaded ✓ / Failed |
| Prompt Input | Textarea, optional |
| CFG Scale Slider | Range 0-1, step 0.01, tampilkan angka saat ini |
| Status Polling | Auto-check setiap 5 detik, tampilkan status di UI |
| Video Preview | Video player inline setelah selesai |
| Download Link | Direct link ke video CDN |
| Generate Another | Reset button setelah selesai/gagal |
| Error Handling | Pesan error jelas dengan detail API response |
| Responsive | Mobile-friendly layout |

---

## API Routes (Backend)

### POST `/api/generate`

Forward generate request ke Freepik API.

**Request Body:**
```json
{
  "model": "kling-2.6-standard",
  "imageUrl": "https://...",
  "videoUrl": "https://...",
  "prompt": "optional",
  "cfgScale": 0.5,
  "apiKey": "FPSXxxx..."
}
```

**Response:** Forward langsung dari Freepik API.

### GET `/api/status`

Check status task.

**Query Params:**
- `taskId` — Task ID dari generate response
- `model` — Model yang digunakan (untuk menentukan endpoint)
- `apiKey` — API key user

**Response:** Forward langsung dari Freepik API.

### POST `/api/upload`

Upload file ke server dan return URL publik.

**Request:** `multipart/form-data` dengan field `file`

**Response:**
```json
{
  "url": "https://yourdomain.com/upload/filename.jpg"
}
```

---

## Deployment

### Option A: Vercel

- Push ke GitHub → auto-deploy
- Limitasi: body size 4.5MB (free tier) untuk upload
- Untuk file > 4.5MB, user harus paste URL langsung

### Option B: Self-hosted (Ubuntu + Nginx)

```bash
# Build
npm install
npm run build

# Run (pilih port yang tersedia)
PORT=3001 npm start
```

Nginx config (contoh subfolder `/apps`):
```nginx
location /apps {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_cache_bypass $http_upgrade;
}
```

Jika deploy di subfolder, tambahkan di `next.config.mjs`:
```js
const nextConfig = {
  basePath: "/apps",
};
```

---

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| "Daily limit reached" | Rate limit harian tercapai | Tunggu 24 jam / upgrade plan |
| "FAILED" (status) | File tidak valid / credit habis | Cek spesifikasi file & balance |
| "Request Entity Too Large" | File > 4.5MB via Vercel | Self-host atau paste URL langsung |
| Non-JSON response | API return text bukan JSON | Parse text, tampilkan sebagai error |
| "No task ID returned" | Response format tidak dikenali | Tampilkan raw response untuk debugging |

---

## Polling Configuration

| Setting | Value |
|---------|-------|
| Poll interval | 5 detik |
| Max timeout | 600 detik (10 menit) |
| Stop condition | Status = COMPLETED / FAILED |
| Status comparison | Case-insensitive (`.toLowerCase()`) |
| Video URL extraction | `data.generated[0]` |

---

## Referensi

- Freepik API Docs: https://docs.freepik.com/api-reference/video/kling-v2-6-motion-control-std
- Kling 3 Motion Control: https://docs.freepik.com/api-reference/video/kling-v3-motion-control/overview
- Contoh implementasi: https://sakenmotion.vercel.app/

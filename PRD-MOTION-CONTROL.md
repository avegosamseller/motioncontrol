# PRD: Motion Control Video Generator (Web App)

## Overview

Web application untuk generate video motion control menggunakan Kling AI (2.6 Standard/Pro, 3.0 Standard/Pro) melalui Freepik API. User upload gambar karakter referensi + video sumber gerakan, lalu AI akan mentransfer gerakan dari video ke karakter.

Aplikasi dilengkapi dengan **API Key Rotation**, **Proxy Server**, **Queue System**, **User Auth**, **History/Gallery**, **Webhook**, **Batch Generate**, **Credit Tracking**, **Auto Compress**, dan **Download All**.

---

## Tech Stack

| Komponen | Teknologi |
|----------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Backend | Next.js API Routes (App Router) |
| Database | SQLite / PostgreSQL (untuk user, history, queue) |
| Auth | NextAuth.js atau custom JWT |
| Proxy Server | Node.js Express (self-hosted) |
| Queue | Bull / BullMQ (Redis-based) atau in-memory queue |
| Hosting | Self-hosted (Nginx + Node.js) |
| File Hosting | Self-hosted via Nginx |
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

### Authentication Header

- Header: `x-freepik-api-key: <API_KEY>`
- API Key format: `FPSXxxxxxxxxxxxxxxxxxxxxxxxxxx`

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

**Catatan:** `character_orientation: "video"` wajib disertakan.

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
| `COMPLETED` | Selesai, video di `generated[0]` |
| `FAILED` | Gagal |

**Catatan:** Status menggunakan **HURUF BESAR**. Lakukan `.toLowerCase()` sebelum compare.

---

## Parameters

| Parameter | Type | Required | Range | Description |
|-----------|------|----------|-------|-------------|
| `image_url` | string (URL) | Ya | - | URL publik gambar karakter |
| `video_url` | string (URL) | Ya | - | URL publik video motion |
| `character_orientation` | string | Ya | `"video"` | Selalu "video" |
| `prompt` | string | Tidak | - | Deskripsi tambahan |
| `cfg_scale` | float | Tidak | 0.0 - 1.0 | 0=kreatif, 1=faithful |

---

## File Requirements

### Image (Reference Character)
- Format: JPG, PNG
- Min: 340px, Max: 10MB
- Aspect ratio: 2:5 sampai 5:2
- URL publik

### Video (Motion Source)
- Format: MP4
- Durasi: 2-10 detik, Max: 10MB
- URL publik

---

## Multi API Key Rotation

### Konsep

Multiple API keys dirotasi otomatis (round-robin). Jika satu key kena daily limit, otomatis pindah ke key berikutnya.

### Konfigurasi

```env
API_KEYS=FPSXkey1,FPSXkey2,FPSXkey3,FPSXkey4
```

### Logika

```
1. Simpan keys dalam array + state (limited/available)
2. Saat generate → ambil key berikutnya yang available
3. Jika response = 429 / "daily limit" / "rate limit" → tandai key limited
4. Otomatis retry dengan key berikutnya
5. Jika semua limited → return error
6. Reset key setelah 24 jam dari waktu limited
```

### State Structure

```json
{
  "keys": [
    { "key": "FPSX...", "limited": false, "limitedAt": null, "requests": 12 },
    { "key": "FPSX...", "limited": true, "limitedAt": "2025-05-15T08:00:00Z", "requests": 50 }
  ],
  "currentIndex": 0
}
```

### Error Detection

Pindah key jika:
- HTTP 429
- Response contains "daily limit" (case-insensitive)
- Response contains "rate limit" (case-insensitive)
- Response contains "quota exceeded" (case-insensitive)

---

## Proxy Server

### Konsep

Proxy sebagai perantara ke Freepik API. Tujuan:
1. Sembunyikan API key dari client
2. Bypass IP-based rate limit
3. Handle rotation di server side

### Architecture

```
User → Web App → Proxy Server (homeserver) → api.freepik.com
                       ↓
              [Key Rotation + Retry]
```

### Proxy Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/proxy/generate` | POST | Forward generate |
| `/proxy/status/{taskId}` | GET | Forward status check |
| `/proxy/health` | GET | Status proxy + key availability |

### Health Response

```json
{
  "status": "ok",
  "totalKeys": 4,
  "availableKeys": 3,
  "limitedKeys": 1,
  "queueLength": 2
}
```

---

## Queue System

### Konsep

Antrian untuk memproses request secara berurutan. Jika banyak user generate bersamaan, request masuk antrian dan diproses satu per satu (atau sesuai concurrency limit).

### Konfigurasi

```env
# Maksimum task yang diproses bersamaan
MAX_CONCURRENT=3

# Maksimum antrian per user
MAX_QUEUE_PER_USER=5

# Timeout per task
TASK_TIMEOUT=600
```

### Flow

```
1. User submit generate request
2. Request masuk ke queue
3. Queue processor ambil task dari antrian
4. Jika slot tersedia (< MAX_CONCURRENT) → proses
5. Jika penuh → tunggu di antrian, beri nomor antrian ke user
6. Setelah selesai → notify user, ambil task berikutnya
```

### Queue Data Structure

```json
{
  "id": "queue-uuid",
  "userId": "user-123",
  "status": "waiting|processing|completed|failed",
  "position": 3,
  "createdAt": "2025-05-15T10:00:00Z",
  "startedAt": null,
  "completedAt": null,
  "params": {
    "model": "kling-2.6-standard",
    "image_url": "...",
    "video_url": "...",
    "prompt": "...",
    "cfg_scale": 0.5
  },
  "result": {
    "task_id": "...",
    "video_url": "..."
  }
}
```

### UI Queue Status

Tampilkan ke user:
- "Posisi antrian: #3"
- "Estimasi: ~5 menit"
- "Sedang diproses..."
- Progress bar

---

## User Authentication

### Konsep

Sistem login agar tiap user punya data sendiri (history, settings, credit).

### Auth Methods

| Method | Description |
|--------|-------------|
| Email + Password | Register/login manual |
| Google OAuth | Login dengan Google (opsional) |
| API Key as Auth | User masukkan API key sebagai identitas (tanpa register) |

### User Data Structure

```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "name": "User Name",
  "apiKey": "FPSXxxx...",
  "createdAt": "2025-05-15T10:00:00Z",
  "settings": {
    "defaultModel": "kling-2.6-standard",
    "defaultCfgScale": 0.5
  }
}
```

### Session

- JWT token disimpan di cookie (httpOnly)
- Expire: 7 hari
- Refresh otomatis

### Pages

| Page | Path | Description |
|------|------|-------------|
| Login | `/login` | Form login email/password |
| Register | `/register` | Form daftar |
| Dashboard | `/dashboard` | Halaman utama setelah login |
| Settings | `/settings` | Ubah API key, default model, dll |

---

## History / Gallery

### Konsep

Simpan semua riwayat generasi. User bisa melihat, download ulang, atau re-generate.

### Data Structure

```json
{
  "id": "history-uuid",
  "userId": "user-123",
  "createdAt": "2025-05-15T10:00:00Z",
  "model": "kling-2.6-standard",
  "prompt": "dancing girl",
  "cfgScale": 0.5,
  "imageUrl": "https://.../image.jpg",
  "videoUrl": "https://.../video.mp4",
  "resultUrl": "https://cdn-magnific.freepik.com/kling_xxx.mp4?token=xxx",
  "status": "completed",
  "taskId": "task-uuid",
  "thumbnailUrl": "https://.../thumb.jpg"
}
```

### UI Features

| Feature | Description |
|---------|-------------|
| Gallery Grid | Tampilkan thumbnail semua hasil |
| Filter | Filter by model, status, tanggal |
| Search | Cari by prompt |
| Re-generate | Gunakan setting yang sama untuk generate ulang |
| Delete | Hapus dari history |
| Bulk Select | Pilih beberapa untuk download/delete |

### API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/history` | GET | List history (paginated) |
| `/api/history/{id}` | GET | Detail satu item |
| `/api/history/{id}` | DELETE | Hapus item |
| `/api/history/bulk-delete` | POST | Hapus banyak item |

---

## Webhook Support

### Konsep

Daripada polling setiap 5 detik, Freepik API bisa mengirim notifikasi langsung ke server kita saat task selesai.

### Konfigurasi

Tambahkan `webhook_url` di generate request:

```json
{
  "image_url": "...",
  "video_url": "...",
  "character_orientation": "video",
  "cfg_scale": 0.5,
  "webhook_url": "https://yourdomain.com/api/webhook"
}
```

### Webhook Receiver

```
POST /api/webhook
```

**Expected Payload dari Freepik:**
```json
{
  "data": {
    "task_id": "uuid-string",
    "status": "COMPLETED",
    "generated": ["https://cdn-magnific.freepik.com/...mp4"]
  }
}
```

### Flow dengan Webhook

```
1. User submit generate → kirim ke API dengan webhook_url
2. API return task_id → tampilkan "Processing..."
3. Saat selesai → API kirim POST ke webhook_url
4. Server terima webhook → update database → notify frontend via WebSocket/SSE
5. Frontend langsung tampilkan video (tanpa polling)
```

### Fallback

Jika webhook tidak datang dalam 10 menit → fallback ke polling.

### Frontend Notification

Gunakan **Server-Sent Events (SSE)** atau **WebSocket** untuk push realtime ke browser:

```
GET /api/events?userId=xxx (SSE)
```

Saat webhook diterima → kirim event ke frontend:
```json
{
  "type": "task_completed",
  "taskId": "...",
  "videoUrl": "..."
}
```

---

## Batch Generate

### Konsep

Upload banyak gambar + 1 video → generate semua secara bersamaan (masuk queue).

### Flow

```
1. User upload 1 video (motion source)
2. User upload multiple gambar (karakter-karakter berbeda)
3. User klik "Batch Generate"
4. Sistem buat task untuk setiap gambar (dengan video yang sama)
5. Semua task masuk queue
6. Proses satu per satu (sesuai MAX_CONCURRENT)
7. Tampilkan progress: "3/10 selesai"
8. Setelah semua selesai → tampilkan gallery + "Download All"
```

### UI

| Element | Description |
|---------|-------------|
| Multi-image upload | Drag & drop atau pilih banyak file |
| Single video upload | 1 video untuk semua |
| Progress bar | "Processing 3/10..." |
| Individual status | Tiap gambar punya status sendiri (waiting/processing/done/failed) |
| Cancel button | Bisa cancel batch yang belum diproses |

### Batch Data Structure

```json
{
  "batchId": "batch-uuid",
  "userId": "user-123",
  "videoUrl": "https://.../video.mp4",
  "model": "kling-2.6-standard",
  "cfgScale": 0.5,
  "prompt": "...",
  "items": [
    { "id": "item-1", "imageUrl": "...", "status": "completed", "resultUrl": "..." },
    { "id": "item-2", "imageUrl": "...", "status": "processing", "taskId": "..." },
    { "id": "item-3", "imageUrl": "...", "status": "waiting" }
  ],
  "totalItems": 10,
  "completedItems": 3,
  "createdAt": "..."
}
```

---

## Credit Tracking

### Konsep

Tampilkan sisa credit/balance dari Magnific/Freepik account di dashboard.

### Implementation

Ada 2 cara:
1. **API call ke Magnific** (jika ada endpoint balance) — cek docs
2. **Track manual** — catat setiap kali generate, kurangi dari estimasi

### Manual Tracking

| Model | Estimasi Cost per Generate |
|-------|---------------------------|
| Kling 2.6 Standard | ~$0.10 |
| Kling 2.6 Pro | ~$0.20 |
| Kling 3.0 Standard | ~$0.15 |
| Kling 3.0 Pro | ~$0.30 |

### UI

```
┌────────────────────────┐
│  💰 Credit: €487.50    │
│  📊 Used today: €12.50 │
│  🎬 Generations: 42    │
└────────────────────────┘
```

### Data Structure

```json
{
  "userId": "user-123",
  "totalCredit": 500.00,
  "usedCredit": 12.50,
  "remainingCredit": 487.50,
  "transactions": [
    { "date": "2025-05-15T10:00:00Z", "model": "kling-2.6-std", "cost": 0.10, "taskId": "..." },
    { "date": "2025-05-15T10:05:00Z", "model": "kling-3.0-pro", "cost": 0.30, "taskId": "..." }
  ]
}
```

---

## Auto Compress Image

### Konsep

Otomatis compress/resize gambar di browser sebelum upload, supaya:
- Tidak terlalu besar (hemat bandwidth)
- Sesuai spesifikasi API (min 340px, max 10MB)
- Optimal untuk hasil terbaik

### Logic

```
1. User pilih gambar
2. Client-side check:
   - Jika > 10MB → compress sampai < 10MB
   - Jika < 340px → reject dengan error
   - Jika > 2048px → resize ke max 2048px (keep aspect ratio)
3. Compress menggunakan Canvas API di browser
4. Output: JPEG quality 85% (atau PNG jika transparent)
5. Upload file yang sudah di-compress
```

### Settings

```json
{
  "maxWidth": 2048,
  "maxHeight": 2048,
  "maxFileSize": 10485760,
  "quality": 0.85,
  "format": "jpeg"
}
```

### UI

- Tampilkan ukuran sebelum & sesudah compress
- Badge: "Compressed: 4.2MB → 1.1MB"

---

## Download All (ZIP)

### Konsep

Download semua hasil video dari batch generate atau history sebagai file ZIP.

### Flow

```
1. User pilih beberapa video dari gallery/batch
2. User klik "Download All"
3. Server fetch semua video URLs
4. Server buat ZIP file on-the-fly (streaming)
5. Browser download ZIP
```

### API Route

```
POST /api/download-zip
```

**Request Body:**
```json
{
  "items": [
    { "url": "https://cdn.../video1.mp4", "filename": "character1_kling26.mp4" },
    { "url": "https://cdn.../video2.mp4", "filename": "character2_kling26.mp4" }
  ]
}
```

**Response:** ZIP file stream (Content-Type: application/zip)

### Alternatif (Client-side)

Untuk file kecil, bisa juga buat ZIP di browser menggunakan library `JSZip`:
```
1. Fetch semua video URLs di browser
2. Buat ZIP menggunakan JSZip
3. Trigger download
```

---

## Application Flow (Complete)

### Single Generate

```
1. User login
2. Upload gambar (auto-compress) → URL
3. Upload video → URL
4. Set model, CFG, prompt
5. Klik Generate
6. Masuk queue (tampilkan posisi)
7. Proxy pilih key (rotation) → kirim ke API
8. Webhook terima notifikasi selesai (atau fallback polling)
9. Update history + tampilkan video
10. Update credit tracking
```

### Batch Generate

```
1. User login
2. Upload 1 video → URL
3. Upload N gambar (auto-compress each) → URLs
4. Set model, CFG, prompt (sama untuk semua)
5. Klik "Batch Generate"
6. Buat N tasks → semua masuk queue
7. Proses sesuai MAX_CONCURRENT
8. Progress: "3/10 selesai"
9. Setelah semua selesai → tampilkan gallery
10. "Download All" → ZIP
```

---

## Web App Pages

| Page | Path | Description |
|------|------|-------------|
| Landing | `/` | Landing page / redirect ke login |
| Login | `/login` | Login form |
| Register | `/register` | Register form |
| Dashboard | `/dashboard` | Generate form + status |
| Batch | `/batch` | Batch generate interface |
| History | `/history` | Gallery semua hasil |
| Settings | `/settings` | API key, default model, profile |
| Queue | `/queue` | Status antrian (admin) |

---

## Environment Variables

### Web App (.env)

```env
# Database
DATABASE_URL=sqlite:///path/to/db.sqlite
# atau: postgres://user:pass@localhost/motioncontrol

# Auth
JWT_SECRET=random-secret-string
NEXTAUTH_URL=https://yourdomain.com/apps

# Proxy
PROXY_URL=https://yourdomain.com/proxy

# Upload
UPLOAD_DIR=/path/to/upload/folder
UPLOAD_URL=https://yourdomain.com/upload

# Queue
MAX_CONCURRENT=3
MAX_QUEUE_PER_USER=5

# Webhook
WEBHOOK_BASE_URL=https://yourdomain.com/api/webhook

# Credit (estimasi cost per model)
COST_KLING_26_STD=0.10
COST_KLING_26_PRO=0.20
COST_KLING_30_STD=0.15
COST_KLING_30_PRO=0.30
```

### Proxy Server (.env)

```env
API_KEYS=FPSXkey1,FPSXkey2,FPSXkey3,FPSXkey4
PORT=3002
ALLOWED_ORIGINS=https://yourdomain.com
```

---

## Deployment (Full Self-hosted)

```
Web App (port 3001) ─────┐
                          │
Proxy Server (port 3002) ─┼── Nginx (port 443) ── Internet
                          │
File Uploads (disk) ──────┘
```

### Nginx Config

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    # Web app
    location /apps {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Proxy server
    location /proxy/ {
        proxy_pass http://localhost:3002/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # File uploads
    location /upload/ {
        alias /path/to/upload/folder/;
        autoindex off;
    }

    # Webhook receiver (public)
    location /api/webhook {
        proxy_pass http://localhost:3001/api/webhook;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| "All API keys limited" | Semua key habis | Tunggu 24 jam / tambah key |
| "Queue full" | Antrian penuh | Tunggu / naikkan limit |
| "FAILED" status | File invalid / credit habis | Cek file & balance |
| "File too large" | Gambar > 10MB | Auto-compress handle ini |
| Webhook timeout | Webhook tidak datang | Fallback ke polling |
| Auth expired | JWT expired | Auto-redirect ke login |

---

## Polling & Webhook Configuration

| Setting | Value |
|---------|-------|
| Poll interval (fallback) | 5 detik |
| Max poll timeout | 600 detik |
| Webhook timeout | 600 detik (fallback to polling) |
| Stop condition | COMPLETED / FAILED |
| Status comparison | Case-insensitive |
| Video URL | `data.generated[0]` |

---

## Referensi

- Freepik API Docs: https://docs.freepik.com/api-reference/video/kling-v2-6-motion-control-std
- Kling 3 Motion Control: https://docs.freepik.com/api-reference/video/kling-v3-motion-control/overview
- Contoh implementasi: https://sakenmotion.vercel.app/

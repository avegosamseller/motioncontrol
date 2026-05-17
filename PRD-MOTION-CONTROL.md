# PRD: Motion Control Video Generator (Web App)

## Overview

Web application untuk generate video motion control menggunakan Kling AI (2.6 Standard/Pro, 3.0 Standard/Pro) melalui Freepik API. User upload gambar karakter referensi + video sumber gerakan, lalu AI akan mentransfer gerakan dari video ke karakter.

Aplikasi ini dilengkapi dengan **API Key Rotation** dan **Proxy Server** untuk mengatasi daily rate limit dari API provider.

---

## Tech Stack

| Komponen | Teknologi |
|----------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Backend | Next.js API Routes (App Router) |
| Proxy Server | Node.js / Nginx reverse proxy (self-hosted) |
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

## API Key Rotation

### Konsep

Sistem menggunakan **multiple API keys** yang dirotasi secara otomatis untuk menghindari daily rate limit per key.

### Konfigurasi

```env
# Multiple API keys dipisah koma
API_KEYS=FPSXkey1xxx,FPSXkey2xxx,FPSXkey3xxx,FPSXkey4xxx
```

### Logika Rotation

```
1. Simpan daftar API keys dalam array
2. Track jumlah request per key per hari (counter)
3. Track key mana yang kena rate limit (blacklist sementara)
4. Saat mau generate:
   a. Ambil key berikutnya yang belum kena limit (round-robin)
   b. Jika key kena error "daily limit reached" → tandai key sebagai limited
   c. Pindah ke key berikutnya
   d. Jika semua key limited → return error "All API keys have reached daily limit"
5. Reset blacklist setiap 24 jam (atau saat key berhasil digunakan lagi)
```

### Data Structure

```json
{
  "keys": [
    { "key": "FPSXkey1...", "limited": false, "lastUsed": "2025-05-15T10:00:00Z", "requestCount": 12 },
    { "key": "FPSXkey2...", "limited": false, "lastUsed": "2025-05-15T09:55:00Z", "requestCount": 8 },
    { "key": "FPSXkey3...", "limited": true, "limitedAt": "2025-05-15T08:00:00Z", "requestCount": 50 }
  ],
  "currentIndex": 1
}
```

### Error Detection untuk Rotation

Trigger pindah ke key berikutnya jika response mengandung:
- HTTP 429 (Too Many Requests)
- Body contains "daily limit" (case-insensitive)
- Body contains "rate limit" (case-insensitive)
- Body contains "quota exceeded" (case-insensitive)

---

## Proxy Server

### Konsep

Proxy server berfungsi sebagai perantara antara web app dan Freepik API. Tujuannya:
1. **Menyembunyikan API key** dari client (key disimpan di server)
2. **Bypass IP-based rate limit** (request datang dari IP server, bukan IP user)
3. **API key rotation** terjadi di proxy (user tidak perlu tahu key mana yang dipakai)

### Architecture

```
User Browser → Web App (Vercel/Self-hosted)
                  ↓
              POST /api/generate
                  ↓
         Proxy Server (self-hosted di homeserver)
                  ↓
         [API Key Rotation Logic]
                  ↓
         api.freepik.com (dengan key yang tersedia)
                  ↓
         Response → kembali ke user
```

### Proxy Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/proxy/generate` | POST | Forward generate request ke Freepik API |
| `/proxy/status/{taskId}` | GET | Forward status check ke Freepik API |
| `/proxy/health` | GET | Check proxy status & available keys |

### Proxy Request/Response

#### POST `/proxy/generate`

**Request Header:**
```
x-proxy-api-key: <user_api_key_atau_master_key>
Content-Type: application/json
```

**Request Body:**
```json
{
  "model": "kling-2.6-std",
  "image_url": "https://...",
  "video_url": "https://...",
  "character_orientation": "video",
  "cfg_scale": 0.5,
  "prompt": "optional"
}
```

**Response:** Forward dari Freepik API (task_id, status)

#### GET `/proxy/status/{taskId}`

**Request Header:**
```
x-proxy-api-key: <user_api_key_atau_master_key>
```

**Query Params:**
- `model` — untuk menentukan status endpoint

**Response:** Forward dari Freepik API (status, generated)

#### GET `/proxy/health`

**Response:**
```json
{
  "status": "ok",
  "totalKeys": 4,
  "availableKeys": 3,
  "limitedKeys": 1
}
```

### Proxy Implementation (Node.js Express)

File: `proxy/server.js`

```javascript
// Pseudocode structure
const express = require('express');
const app = express();

// Load API keys dari env
const API_KEYS = process.env.API_KEYS.split(',');

// State tracking
let keyStates = API_KEYS.map(key => ({
  key,
  limited: false,
  limitedAt: null,
  requestCount: 0
}));
let currentIndex = 0;

// Get next available key (round-robin, skip limited)
function getNextKey() {
  for (let i = 0; i < keyStates.length; i++) {
    const idx = (currentIndex + i) % keyStates.length;
    const state = keyStates[idx];
    
    // Reset limit after 24 hours
    if (state.limited && state.limitedAt) {
      const hoursSinceLimited = (Date.now() - state.limitedAt) / (1000 * 60 * 60);
      if (hoursSinceLimited >= 24) {
        state.limited = false;
        state.limitedAt = null;
        state.requestCount = 0;
      }
    }
    
    if (!state.limited) {
      currentIndex = (idx + 1) % keyStates.length;
      return state;
    }
  }
  return null; // All keys limited
}

// Mark key as limited
function markKeyLimited(key) {
  const state = keyStates.find(s => s.key === key);
  if (state) {
    state.limited = true;
    state.limitedAt = Date.now();
  }
}

// Check if response indicates rate limit
function isRateLimited(status, body) {
  if (status === 429) return true;
  const text = JSON.stringify(body).toLowerCase();
  return text.includes('daily limit') || 
         text.includes('rate limit') || 
         text.includes('quota exceeded');
}

// POST /proxy/generate
app.post('/proxy/generate', async (req, res) => {
  const keyState = getNextKey();
  if (!keyState) {
    return res.status(429).json({ error: 'All API keys have reached daily limit. Try again later.' });
  }
  
  // Forward to Freepik API with selected key
  // If rate limited → markKeyLimited → retry with next key
  // Return response to client
});

// GET /proxy/status/:taskId
app.get('/proxy/status/:taskId', async (req, res) => {
  // Forward to Freepik API
});

app.listen(3002);
```

### Proxy Deployment (Homeserver)

```bash
# Install
cd /opt/motioncontrol/proxy
npm install

# Environment
cp .env.example .env
nano .env
# API_KEYS=FPSXkey1,FPSXkey2,FPSXkey3

# Run
node server.js

# Systemd service
sudo systemctl enable motioncontrol-proxy
sudo systemctl start motioncontrol-proxy
```

Nginx config:
```nginx
location /proxy/ {
    proxy_pass http://localhost:3002/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

---

## Application Flow (dengan Proxy & Rotation)

### Generate Video Flow

```
1. User masukkan API key (opsional jika proxy punya key sendiri)
2. User pilih model (Kling 2.6/3.0, Standard/Pro)
3. User upload gambar referensi → dapat URL publik
4. User upload video motion → dapat URL publik
5. User atur CFG scale (slider 0-1) dan prompt (opsional)
6. User klik "Generate Video"
7. Frontend POST ke /api/generate
8. Backend forward ke Proxy Server (/proxy/generate)
9. Proxy pilih API key yang tersedia (rotation)
10. Proxy forward ke api.freepik.com
11. Jika kena rate limit → proxy otomatis retry dengan key lain
12. API return task_id
13. Frontend polling GET /api/status → Proxy → api.freepik.com
14. Saat status = "COMPLETED" → ambil URL dari data.generated[0]
15. Tampilkan video preview + download link
16. Stop polling
```

### Rate Limit Handling Flow

```
1. Proxy kirim request dengan Key A
2. API return 429 atau "daily limit reached"
3. Proxy tandai Key A sebagai limited
4. Proxy otomatis retry dengan Key B
5. Jika Key B juga limited → coba Key C
6. Jika semua key limited → return error ke user
7. Key A akan di-reset setelah 24 jam
```

---

## Web App Features

| Feature | Description |
|---------|-------------|
| API Key Input | Password field, user masukkan API key sendiri (opsional jika pakai proxy) |
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
| Proxy Status | Tampilkan jumlah key tersedia (opsional) |

---

## API Routes (Backend)

### POST `/api/generate`

Forward generate request ke Proxy Server → Freepik API.

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

**Backend Logic:**
1. Validasi input
2. Forward ke proxy server (`PROXY_URL/proxy/generate`)
3. Sertakan API key di header `x-proxy-api-key`
4. Return response ke frontend

### GET `/api/status`

Check status task via Proxy.

**Query Params:**
- `taskId` — Task ID dari generate response
- `model` — Model yang digunakan
- `apiKey` — API key user

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

## Environment Variables

### Web App (.env)

```env
# Proxy server URL (self-hosted)
PROXY_URL=https://yourdomain.com/proxy

# Opsional: default API key jika tidak pakai proxy
DEFAULT_API_KEY=FPSXxxx...
```

### Proxy Server (.env)

```env
# Multiple API keys dipisah koma
API_KEYS=FPSXkey1xxx,FPSXkey2xxx,FPSXkey3xxx

# Port proxy server
PORT=3002

# Allowed origins (CORS)
ALLOWED_ORIGINS=https://yourdomain.com,https://motioncontrol-iota.vercel.app
```

---

## Deployment

### Option A: Vercel (Web App) + Self-hosted Proxy

```
Web App (Vercel) → Proxy (homeserver:3002) → api.freepik.com
```

- Web app di Vercel (gratis, auto-deploy)
- Proxy di homeserver (handle rotation + bypass limit)

### Option B: Full Self-hosted

```
Web App (homeserver:3001) → Proxy (homeserver:3002) → api.freepik.com
```

- Semua di homeserver
- Tidak ada file size limit
- Full control

### Nginx Config (Full Self-hosted)

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
        proxy_cache_bypass $http_upgrade;
    }

    # Proxy server
    location /proxy/ {
        proxy_pass http://localhost:3002/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # File uploads
    location /upload/ {
        alias /path/to/upload/folder/;
        autoindex off;
    }
}
```

---

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| "All API keys have reached daily limit" | Semua key limited | Tunggu 24 jam / tambah key baru |
| "Daily limit reached" (single key) | Satu key limited | Otomatis rotation ke key lain |
| "FAILED" (status) | File tidak valid / credit habis | Cek spesifikasi file & balance |
| "Request Entity Too Large" | File > 4.5MB via Vercel | Self-host atau paste URL langsung |
| Non-JSON response | API return text bukan JSON | Parse text, tampilkan sebagai error |
| Proxy unreachable | Homeserver down | Fallback ke direct API call |

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

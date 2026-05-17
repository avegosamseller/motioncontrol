# PRD: Motion Control Video Generator

## Overview

Web application dan Telegram bot untuk generate video motion control menggunakan Kling AI (2.6 Standard/Pro, 3.0 Standard/Pro) melalui Freepik/Magnific API.

---

## Tech Stack

| Komponen | Teknologi |
|----------|-----------|
| Web Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Web Backend | Next.js API Routes (App Router) |
| Telegram Bot | Python 3.10+, python-telegram-bot, aiohttp |
| Hosting Web | Vercel / Self-hosted (Nginx + systemd) |
| Hosting Bot | Ubuntu server (systemd service) |
| File Hosting | Self-hosted via Nginx (domain sendiri) |
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
- Dapatkan dari: https://magnific.com atau https://freepik.com/api

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

---

## Parameters

| Parameter | Type | Required | Range | Description |
|-----------|------|----------|-------|-------------|
| `image_url` | string (URL) | Ya | - | URL publik gambar karakter referensi (min 340px, max 10MB, JPG/PNG) |
| `video_url` | string (URL) | Ya | - | URL publik video motion source (MP4, max 10MB, 2-10 detik) |
| `character_orientation` | string | Ya | `"video"` | Orientasi karakter mengikuti video |
| `prompt` | string | Tidak | - | Deskripsi tambahan untuk hasil video |
| `cfg_scale` | float | Tidak | 0.0 - 1.0 | 0 = lebih kreatif, 1 = lebih faithful ke referensi |

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

## Flow Aplikasi

### Flow Generate Video

```
1. User upload/input image URL + video URL
2. Client kirim POST ke /api/generate dengan payload
3. Server forward ke api.freepik.com
4. API return task_id
5. Client polling GET /api/status?taskId=xxx setiap 5 detik
6. Saat status = "COMPLETED" → ambil URL dari generated[0]
7. Tampilkan video preview + download link
8. Stop polling
```

### Flow Upload File (untuk hosting sendiri)

```
1. User pilih file dari device
2. File di-upload ke server (homeserver atau cloud storage)
3. Server simpan file dan return URL publik
4. URL digunakan sebagai image_url atau video_url
```

---

## Web App Features

| Feature | Description |
|---------|-------------|
| API Key Input | Password field, user masukkan API key sendiri |
| Model Selection | Dropdown: Kling 2.6 Std/Pro, 3.0 Std/Pro |
| Image Upload | Upload file + auto-host, atau paste URL |
| Video Upload | Upload file + auto-host, atau paste URL |
| Prompt Input | Textarea, optional |
| CFG Scale Slider | Range 0-1, step 0.01 |
| Status Polling | Auto-check setiap 5 detik, tampilkan status |
| Video Preview | Player inline setelah selesai |
| Download Link | Direct link ke video CDN |
| Error Handling | Pesan error jelas, termasuk API response |

---

## Telegram Bot Features

| Feature | Description |
|---------|-------------|
| `/start` | Welcome message + panduan |
| `/model` | Inline keyboard pilih model |
| `/cfg 0.5` | Atur CFG scale |
| `/prompt text` | Atur prompt |
| `/status` | Lihat pengaturan saat ini |
| `/generate` | Manual trigger generate |
| `/reset` | Reset semua setting |
| Kirim foto | Auto-save sebagai reference image |
| Kirim video | Auto-save sebagai motion source |
| Auto-generate | Otomatis generate saat foto + video lengkap |
| Auto-delete | Hapus pesan upload setelah berhasil |
| Status update | Edit message saat polling status |
| Video delivery | Kirim video langsung ke chat |

---

## Deployment

### Option A: Vercel (Web App)

- Push ke GitHub → auto-deploy
- Tidak perlu konfigurasi tambahan
- Limitasi: body size 4.5MB (free tier)

### Option B: Self-hosted (Homeserver)

```bash
# Build
npm install
npm run build

# Run
PORT=3001 npm start

# Nginx reverse proxy
location /apps {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

### Telegram Bot (Homeserver)

```bash
# Setup
python3 -m venv venv
source venv/bin/activate
pip install python-telegram-bot==21.6 aiohttp==3.10.10 python-dotenv==1.0.1

# Run
python bot.py

# Systemd service untuk 24/7
sudo systemctl enable motioncontrol-bot
sudo systemctl start motioncontrol-bot
```

---

## Environment Variables

### Web App (.env)

```env
# Tidak perlu env - API key diinput user di UI
```

### Telegram Bot (.env)

```env
TELEGRAM_BOT_TOKEN=bot_token_dari_botfather
MAGNIFIC_API_KEY=FPSXxxxxxxxxxxxxxxxxxxxxx
BASE_URL=https://yourdomain.com
UPLOAD_DIR=/path/to/upload/folder
UPLOAD_URL_PATH=/upload
```

---

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| "Daily limit reached" | Rate limit per hari | Tunggu 24 jam reset / upgrade plan |
| "FAILED" tanpa detail | File tidak valid / credit habis | Cek spesifikasi file, cek balance |
| "Request Entity Too Large" | File > 4.5MB via Vercel | Gunakan self-hosted atau URL langsung |
| "Unexpected token 'R'" | Response non-JSON | Sudah di-handle, tampilkan error text |
| Upload "Failed" | CORS / body limit | Upload via server proxy / paste URL |

---

## Polling Configuration

| Setting | Value |
|---------|-------|
| Poll interval | 5 detik |
| Max timeout | 600 detik (10 menit) |
| Stop condition | Status = COMPLETED / FAILED |

---

## Referensi

- Freepik API Docs: https://docs.freepik.com/api-reference/video/kling-v2-6-motion-control-std
- Magnific API Docs: https://docs.magnific.com
- Kling 3 Motion Control: https://docs.freepik.com/api-reference/video/kling-v3-motion-control/overview
- Contoh implementasi: https://sakenmotion.vercel.app/

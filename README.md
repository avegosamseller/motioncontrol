# Motion Control Generator

A web tool to generate motion control videos using **Kling AI** (2.6 Standard, 2.6 Pro, 3.0 Standard, 3.0 Pro) via the **Magnific API**.

## Features

- Upload reference image (character) and reference video (motion source)
- Support for URL input or file upload
- Select from 4 Kling models:
  - Kling 2.6 Standard
  - Kling 2.6 Pro
  - Kling 3.0 Standard
  - Kling 3.0 Pro
- Adjustable CFG Scale (0-1)
- Optional prompt input
- Real-time status polling
- Video preview and download

## Getting Started

### Prerequisites

- Node.js 18+ 
- A Magnific API key (get one at [magnific.com](https://magnific.com))

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/avegosam-three/motioncontrol)

## Usage

1. Enter your Magnific API key
2. Select the Kling model version
3. Upload a reference image (the character you want to animate)
4. Upload a reference video (the motion source)
5. Optionally add a prompt describing the desired output
6. Adjust CFG Scale (higher = more faithful to reference)
7. Click "Generate Video"
8. Wait for processing (usually 1-5 minutes)
9. Download or preview your generated video

## API Endpoints

### POST `/api/generate`

Submit a new motion control video generation task.

**Body:**
```json
{
  "model": "kling-2.6-standard",
  "imageUrl": "https://...",
  "videoUrl": "https://...",
  "prompt": "optional description",
  "cfgScale": 0.5,
  "apiKey": "your-magnific-api-key"
}
```

### GET `/api/status`

Check the status of a generation task.

**Query params:**
- `taskId` - The task ID from the generate response
- `model` - The model used
- `apiKey` - Your Magnific API key

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Magnific API (Kling Motion Control)

# ScriptureReel Backend Server

Secure proxy server for xAI Grok TTS (Leo voice) and video generation.
Deployed on Railway or Render — free tier works perfectly.

---

## What This Does

The Claude dashboard artifact cannot call `api.x.ai` directly (browser sandbox
restriction). This server runs on your own host, receives requests from the
dashboard, and forwards them securely to xAI on your behalf.

```
Dashboard (browser) → your server → api.x.ai → response back to dashboard
```

Your xAI API key is never stored on the server — it travels in the request
header from your dashboard session only.

---

## Deploy to Railway (Recommended — Free)

**Step 1 — Create a GitHub repo**
1. Go to github.com → New repository
2. Name it `scripturereel-server`
3. Upload all files from this folder (server.js, package.json, railway.json,
   .gitignore, .env.example)

**Step 2 — Deploy on Railway**
1. Go to railway.app → Sign up free (use GitHub login)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your `scripturereel-server` repo
4. Railway auto-detects Node.js and deploys in ~2 minutes
5. Click your deployment → Settings → Networking → Generate Domain
6. Copy your domain — it will look like:
   `https://scripturereel-server-production.up.railway.app`

**Step 3 — Update the dashboard**
In `scripturereel-dashboard.jsx`, find this line near the top:
```js
const SERVER_URL = "https://scripturereel-server.up.railway.app";
```
Replace the URL with your actual Railway domain.

**Step 4 — Test it**
Open your Railway domain in a browser. You should see:
```json
{
  "status": "ok",
  "service": "ScriptureReel API Server",
  "version": "1.0.0"
}
```

Done. Your pipeline is fully live.

---

## Deploy to Render (Alternative — Also Free)

1. Go to render.com → Sign up free
2. New → Web Service → Connect GitHub repo
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Deploy → copy your `.onrender.com` URL
6. Update `SERVER_URL` in the dashboard

---

## API Endpoints

### GET /
Health check. Returns server status.

### POST /tts
Generates Leo narration audio.

**Headers:**
- `Content-Type: application/json`
- `x-api-key: xai-your-key-here`

**Body:**
```json
{
  "text": "Your narration script here with [pause] tags",
  "voice": "leo"
}
```

**Returns:** MP3 audio binary (audio/mpeg)

---

### POST /video/generate
Submits a Grok video generation job.

**Headers:**
- `Content-Type: application/json`
- `x-api-key: xai-your-key-here`

**Body:**
```json
{
  "prompt": "Cinematic aerial shot of Jerusalem at golden hour...",
  "duration": 10,
  "aspect_ratio": "9:16",
  "resolution": "720p"
}
```

**Returns:**
```json
{ "requestId": "abc123" }
```

---

### GET /video/status/:requestId
Polls video job status.

**Headers:**
- `x-api-key: xai-your-key-here`

**Returns:**
```json
{
  "status": "done",
  "videoUrl": "https://..."
}
```

Status values: `pending` | `processing` | `done` | `failed` | `expired`

---

## Security Notes

- Your xAI API key is passed per-request in `x-api-key` header
- Key is never stored on the server or logged
- CORS is restricted to claude.ai and localhost only
- Rotate your key anytime at console.x.ai — no server changes needed

---

## Local Development

```bash
npm install
npm run dev
```

Server starts at http://localhost:3001

Test health:
```bash
curl http://localhost:3001/
```

Test TTS:
```bash
curl -X POST http://localhost:3001/tts \
  -H "Content-Type: application/json" \
  -H "x-api-key: xai-your-key" \
  -d '{"text": "God is good. All the time.", "voice": "leo"}' \
  --output test.mp3
```

---

Built for ScriptureReel by Sarai ✦

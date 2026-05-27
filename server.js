/**
 * ScriptureReel Backend Server
 * Proxies xAI (Grok TTS + Video) API calls securely from the dashboard.
 * Deploy to Railway, Render, or any Node.js host.
 */

import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import FormData from "form-data";

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "2mb" }));
app.use(cors({
  origin: true, // Allow all — xAI key is per-request, not stored server-side
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-api-key"],
}));

// ── Auth middleware ─────────────────────────────────────────────────────────
// Clients pass their xAI API key in x-api-key header
function getApiKey(req) {
  const key = req.headers["x-api-key"] || "";
  if (!key || !key.startsWith("xai-")) {
    return null;
  }
  return key;
}

// ── Health check ────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "ScriptureReel API Server",
    version: "1.0.0",
    endpoints: ["/tts", "/video/generate", "/video/status/:requestId"],
  });
});

// ── POST /tts ───────────────────────────────────────────────────────────────
// Generates Leo narration via Grok TTS
// Body: { text: string, voice?: string }
// Returns: MP3 audio binary (audio/mpeg)
app.post("/tts", async (req, res) => {
  const apiKey = getApiKey(req);
  if (!apiKey) {
    return res.status(401).json({ error: "Missing or invalid xAI API key in x-api-key header" });
  }

  const { text, voice = "leo" } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Missing required field: text" });
  }
  if (text.length > 15000) {
    return res.status(400).json({ error: "Text exceeds 15,000 character limit" });
  }

  try {
    console.log(`[TTS] Generating ${voice} narration — ${text.length} chars`);

    const xaiRes = await fetch("https://api.x.ai/v1/tts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-tts",
        input: text,
        voice,
        response_format: "mp3",
      }),
    });

    if (!xaiRes.ok) {
      const errData = await xaiRes.json().catch(() => ({}));
      console.error("[TTS] xAI error:", errData);
      return res.status(xaiRes.status).json({
        error: errData?.error?.message || `xAI TTS error: ${xaiRes.status}`,
      });
    }

    // Stream the audio binary back to client
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    xaiRes.body.pipe(res);
    console.log("[TTS] Audio streamed successfully");

  } catch (err) {
    console.error("[TTS] Server error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /video/generate ────────────────────────────────────────────────────
// Submits a Grok video generation job
// Body: { prompt: string, duration?: number, aspect_ratio?: string, resolution?: string }
// Returns: { requestId: string }
app.post("/video/generate", async (req, res) => {
  const apiKey = getApiKey(req);
  if (!apiKey) {
    return res.status(401).json({ error: "Missing or invalid xAI API key in x-api-key header" });
  }

  const {
    prompt,
    duration = 10,
    aspect_ratio = "9:16",
    resolution = "720p",
  } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Missing required field: prompt" });
  }

  try {
    console.log(`[VIDEO] Submitting generation job — "${prompt.slice(0, 60)}..."`);

    const xaiRes = await fetch("https://api.x.ai/v1/videos/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-imagine-video",
        prompt,
        duration,
        aspect_ratio,
        resolution,
      }),
    });

    const data = await xaiRes.json();
    if (!xaiRes.ok) {
      console.error("[VIDEO] xAI submit error:", data);
      return res.status(xaiRes.status).json({
        error: data?.error?.message || `xAI video error: ${xaiRes.status}`,
      });
    }

    const requestId = data.request_id;
    if (!requestId) {
      return res.status(500).json({ error: "No request_id returned from xAI" });
    }

    console.log(`[VIDEO] Job submitted — requestId: ${requestId}`);
    res.json({ requestId });

  } catch (err) {
    console.error("[VIDEO] Server error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /video/status/:requestId ────────────────────────────────────────────
// Polls video job status
// Returns: { status: "pending"|"processing"|"done"|"failed", videoUrl?: string }
app.get("/video/status/:requestId", async (req, res) => {
  const apiKey = getApiKey(req);
  if (!apiKey) {
    return res.status(401).json({ error: "Missing or invalid xAI API key in x-api-key header" });
  }

  const { requestId } = req.params;
  if (!requestId) {
    return res.status(400).json({ error: "Missing requestId" });
  }

  try {
    const xaiRes = await fetch(`https://api.x.ai/v1/videos/${requestId}`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });

    const data = await xaiRes.json();
    if (!xaiRes.ok) {
      return res.status(xaiRes.status).json({
        error: data?.error?.message || `Poll error: ${xaiRes.status}`,
      });
    }

    const status = data.status;
    const videoUrl = data.video?.url || null;

    console.log(`[VIDEO] Poll ${requestId} — status: ${status}`);
    res.json({ status, videoUrl });

  } catch (err) {
    console.error("[VIDEO] Poll error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✦ ScriptureReel Server running on port ${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/`);
  console.log(`  TTS:    POST http://localhost:${PORT}/tts`);
  console.log(`  Video:  POST http://localhost:${PORT}/video/generate`);
  console.log(`  Poll:   GET  http://localhost:${PORT}/video/status/:id`);
});

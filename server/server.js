import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import { GoogleGenAI, createUserContent, createPartFromUri } from '@google/genai';

const app = express();

// ---------- Basic middlewares ----------
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static: serve client build in production (client/dist)
const CLIENT_DIR = path.join(process.cwd(), 'client', 'dist');
if (fsSync.existsSync(CLIENT_DIR)) {
  app.use(express.static(CLIENT_DIR));
}

// Multer: temporary disk storage for incoming uploads
const upload = multer({ dest: path.join(process.cwd(), 'uploads') });

// ---------- GenAI client ----------
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const ai = new GoogleGenAI({ apiKey });
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

async function uploadToGemini(file) {
  const uploaded = await ai.files.upload({
    file: file.path,
    config: { mimeType: file.mimetype, displayName: file.originalname },
  });
  return uploaded; // returns { name, uri, mimeType, ... }
}

function buildContents({ prompt, uploadedFiles }) {
  const parts = [];
  for (const f of uploadedFiles) {
    parts.push(createPartFromUri(f.uri, f.mimeType));
  }
  if (prompt && prompt.trim()) parts.push(prompt.trim());
  return createUserContent(parts);
}

// ---------- Endpoints ----------

// health
app.get('/health', (_req, res) => res.json({ ok: true, model: MODEL }));

// text only
app.post('/api/chat', async (req, res) => {
  try {
    const { prompt, config } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'prompt diperlukan' });

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config,
    });

    return res.json({ text: response.text, raw: response });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Gagal memproses', detail: err?.message });
  }
});

// multimodal: prompt + multiple files
app.post('/api/chat-multimodal', upload.array('files', 10), async (req, res) => {
  const tempFiles = req.files || [];
  try {
    const { prompt } = req.body || {};

    const uploadedFiles = [];
    for (const f of tempFiles) {
      const up = await uploadToGemini(f);
      uploadedFiles.push({ uri: up.uri, mimeType: up.mimeType, name: up.displayName || up.name });
    }

    const contents = buildContents({ prompt, uploadedFiles });

    const response = await ai.models.generateContent({ model: MODEL, contents });

    return res.json({
      text: response.text,
      files: uploadedFiles,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Gagal memproses', detail: err?.message });
  } finally {
    await Promise.allSettled((tempFiles || []).map((f) => fs.unlink(f.path).catch(() => {})));
  }
});

// Fallback to SPA index.html if built
if (fsSync.existsSync(CLIENT_DIR)) {
  app.get('*', (_req, res) => res.sendFile(path.join(CLIENT_DIR, 'index.html')));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  if (!apiKey) {
    console.warn('⚠️  No API key found. Set GOOGLE_API_KEY or GEMINI_API_KEY in your .env');
  }
});

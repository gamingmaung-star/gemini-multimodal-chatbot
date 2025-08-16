# Gemini Multimodal Chatbot — Fullstack (Express + React + Tailwind)

Multimodal chatbot menggunakan **Gemini API**: bisa mengolah **teks, gambar, audio, video, PDF**. Frontend modern (React + Tailwind), backend Express. Default model: `gemini-2.5-flash`.

## 1) Prasyarat

- **Node.js 20+** dan npm
- API key dari **Google AI Studio**
- Sistem operasi apa pun

## 2) Cara penggunaan

```bash
# 1) Ekstrak ZIP ini
# 2) Setup backend
cd server
cp .env        #  isi GEMINI_API_KEY=...
npm i
npm run dev                 # dev mode (http://localhost:3000)

# 3) Setup frontend (di tab terminal lain)
cd ../client
npm i
npm run dev                 # dev mode (http://localhost:5173)
# Vite otomatis proxy /api ke http://localhost:3000
```

## 4) Fitur

- Kirim **teks** ke `/api/chat`
- Kirim **teks + file** ke `/api/chat-multimodal` (FormData)
- Drag & drop file, paste screenshot, preview gambar/audio/video, perekam audio
- Dark/light mode dan UI responsif

## 5) Catatan

- **Jangan** menaruh API key di frontend untuk produksi (keamanan).
- Files API menyimpan file sementara (±48 jam). Untuk arsip jangka panjang simpan sendiri.
- Ganti model via `GEMINI_MODEL` di `.env` (mis. `gemini-2.5-pro`).

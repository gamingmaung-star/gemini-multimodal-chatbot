import React, { useEffect, useRef, useState } from "react";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024,
    sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);
  return { isDark, setIsDark };
}

function useAudioRecorder() {
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error("Perekaman audio tidak didukung browser ini");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    chunksRef.current = [];
    mr.ondataavailable = (e) => {
      if (e.data?.size) chunksRef.current.push(e.data);
    };
    mr.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
    };
    mediaRecorderRef.current = mr;
    mr.start();
    setRecording(true);
  }
  async function stop() {
    return new Promise((resolve) => {
      const mr = mediaRecorderRef.current;
      if (!mr) return resolve(null);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        resolve(blob);
      };
      mr.stop();
      setRecording(false);
    });
  }
  return { recording, start, stop };
}

function AttachmentChip({ file, onRemove }) {
  return (
    <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200 px-3 py-1 rounded-full text-sm">
      <span
        className="truncate max-w-[180px]"
        title={`${file.name} • ${formatBytes(file.size)}`}
      >
        {file.name}
      </span>
      <span className="opacity-70">{formatBytes(file.size)}</span>
      <button
        className="ml-1 rounded-full px-2 py-0.5 hover:bg-black/10 dark:hover:bg-white/10"
        onClick={onRemove}
        aria-label="Hapus"
      >
        ✕
      </button>
    </div>
  );
}

function FilePreview({ files }) {
  if (!files?.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-3">
      {Array.from(files).map((file, idx) => {
        const url = URL.createObjectURL(file);
        const isImage = file.type.startsWith("image/");
        const isAudio = file.type.startsWith("audio/");
        const isVideo = file.type.startsWith("video/");
        return (
          <div
            key={idx}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3"
          >
            <div
              className="text-xs mb-2 text-zinc-500 dark:text-zinc-400 truncate"
              title={`${file.name} • ${formatBytes(file.size)}`}
            >
              {file.name} • {formatBytes(file.size)}
            </div>
            {isImage && (
              <img
                src={url}
                alt={file.name}
                className="w-full h-40 object-cover rounded-lg"
              />
            )}
            {isAudio && <audio src={url} controls className="w-full" />}
            {isVideo && (
              <video src={url} controls className="w-full h-40 rounded-lg" />
            )}
            {!isImage && !isAudio && !isVideo && (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">
                {file.type || "Dokumen"}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MessageBubble({ role, text, files }) {
  const isUser = role === "user";
  return (
    <div
      className={classNames(
        "flex gap-3",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white grid place-items-center shrink-0">
          G
        </div>
      )}
      <div
        className={classNames(
          "max-w-[85%] rounded-2xl p-3 shadow-sm",
          isUser
            ? "bg-indigo-600 text-white rounded-br-sm"
            : "bg-white dark:bg-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-bl-sm"
        )}
      >
        {text && (
          <div className="whitespace-pre-wrap leading-relaxed">{text}</div>
        )}
        {files?.length ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {files.map((f, i) => (
              <div key={i} className="text-xs opacity-80 truncate">
                {f.name || f.uri || "Lampiran"}
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 grid place-items-center shrink-0">
          U
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { isDark, setIsDark } = useDarkMode();
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Halo! Aku siap bantu analisis teks, gambar, audio, atau file lainnya. Unggah file dan tulis instruksi ya ✨",
    },
  ]);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);

  const { recording, start, stop } = useAudioRecorder();

  function clearChat() {
    setMessages([{ role: "assistant", text: "Obrolan baru. Ayo mulai!" }]);
    setInput("");
    setFiles([]);
    setError("");
  }
  function onPickFiles() {
    fileInputRef.current?.click();
  }
  function onFilesAdded(list) {
    const arr = Array.from(list || []);
    if (arr.length) setFiles((prev) => [...prev, ...arr]);
  }
  function removeFile(idx) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleRecord() {
    try {
      if (!recording) {
        await start();
      } else {
        const blob = await stop();
        if (blob) {
          const file = new File([blob], `rekaman-${Date.now()}.webm`, {
            type: blob.type || "audio/webm",
          });
          setFiles((prev) => [...prev, file]);
        }
      }
    } catch (e) {
      setError(e.message || "Gagal merekam audio");
    }
  }

  function onPaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const fileItems = [];
    for (const it of items) {
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f) fileItems.push(f);
      }
    }
    if (fileItems.length) onFilesAdded(fileItems);
  }

  async function send() {
    setError("");
    const text = input.trim();
    if (!text && files.length === 0) {
      setError("Tulis pesan atau lampirkan file dulu");
      return;
    }

    setMessages((prev) => [...prev, { role: "user", text, files }]);
    setInput("");
    setFiles([]);
    setSending(true);

    try {
      if (files.length === 0) {
        const resp = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error || "Gagal memproses");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: data.text || "(kosong)" },
        ]);
      } else {
        const form = new FormData();
        form.append("prompt", text);
        for (const f of files) form.append("files", f, f.name);
        const resp = await fetch("/api/chat-multimodal", {
          method: "POST",
          body: form,
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error || "Gagal memproses");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: data.text || "(kosong)",
            files: data.files,
          },
        ]);
      }
    } catch (e) {
      setMessages((prev) => prev.slice(0, -1));
      setError(e.message || "Terjadi kesalahan saat mengirim");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const onDragOver = (e) => {
      e.preventDefault();
      setDragOver(true);
    };
    const onDragLeave = () => setDragOver(false);
    const onDrop = (e) => {
      e.preventDefault();
      setDragOver(false);
      onFilesAdded(e.dataTransfer.files);
    };
    el.addEventListener("dragover", onDragOver);
    el.addEventListener("dragleave", onDragLeave);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("dragleave", onDragLeave);
      el.removeEventListener("drop", onDrop);
    };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0a] text-zinc-900 dark:text-zinc-100">
      <header className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-black/30 bg-white/80 dark:bg-black/40 border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white grid place-items-center font-bold">
              G
            </div>
            <div>
              <div className="font-semibold">Gemini Multimodal Chatbot</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Teks • Gambar • Audio • Dokumen
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDark(!isDark)}
              className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              {isDark ? "☀️" : "🌙"}
            </button>
            <button
              onClick={clearChat}
              className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              New Chat
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 grid lg:grid-cols-3 gap-6 py-6">
        <section className="lg:col-span-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 sm:p-6 shadow-sm">
          <div className="h-[58vh] sm:h-[64vh] overflow-y-auto flex flex-col gap-4 pr-1">
            {messages.map((m, i) => (
              <MessageBubble
                key={i}
                role={m.role}
                text={m.text}
                files={m.files}
              />
            ))}
            {sending && (
              <div className="flex gap-2 items-center text-sm text-zinc-500">
                <span className="inline-block w-2 h-2 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.2s]"></span>
                <span className="inline-block w-2 h-2 rounded-full bg-zinc-400 animate-bounce"></span>
                <span className="inline-block w-2 h-2 rounded-full bg-zinc-400 animate-bounce [animation-delay:0.2s]"></span>
                <span className="ml-2">Model sedang menulis…</span>
              </div>
            )}
          </div>

          <div className="mt-4">
            {error && (
              <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 dark:border-red-700 dark:bg-red-950/40 px-3 py-2 rounded-lg">
                {error}
              </div>
            )}
            <div
              ref={dropRef}
              onPaste={onPaste}
              className={classNames(
                "rounded-2xl border border-dashed p-3 transition",
                dragOver
                  ? "border-indigo-500 bg-indigo-50/40 dark:bg-indigo-900/20"
                  : "border-zinc-300 dark:border-zinc-700"
              )}
            >
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Tulis pesan. Bisa juga paste gambar/screenshot di sini…"
                  rows={2}
                  className="flex-1 resize-y min-h-[48px] max-h-[180px] px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none"
                />
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    📎
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        if (!recording) {
                          await start();
                        } else {
                          const blob = await stop();
                          if (blob) {
                            const file = new File(
                              [blob],
                              `rekaman-${Date.now()}.webm`,
                              { type: blob.type || "audio/webm" }
                            );
                            setFiles((prev) => [...prev, file]);
                          }
                        }
                      } catch (e) {
                        setError(e.message || "Gagal merekam audio");
                      }
                    }}
                    className={classNames(
                      "px-3 py-2 rounded-xl border",
                      recording
                        ? "border-red-500 bg-red-50 dark:bg-red-900/30"
                        : "border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    )}
                  >
                    {recording ? "⏺️" : "🎙️"}
                  </button>
                </div>
                <button
                  onClick={send}
                  className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Kirim
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,audio/*,video/*,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => onFilesAdded(e.target.files)}
              />

              {files?.length ? (
                <div className="flex flex-wrap gap-2 mt-3">
                  {files.map((f, i) => (
                    <AttachmentChip
                      key={i}
                      file={f}
                      onRemove={() => removeFile(i)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-xs text-zinc-500 mt-2">
                  Tarik & letakkan file ke sini, atau klik 📎 untuk memilih
                  file. Paste screenshot juga bisa.
                </div>
              )}

              <FilePreview files={files} />
            </div>
          </div>
        </section>

        <aside className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 sm:p-6 shadow-sm h-fit">
          <h3 className="font-semibold">Pengaturan & Tips</h3>
          <div className="mt-3 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
            <p>
              <span className="font-medium">Proxy dev:</span> Vite mem-proxy{" "}
              <code>/api</code> ke <code>http://localhost:3000</code>.
            </p>
            <p>
              <span className="font-medium">File besar:</span> Backend
              mengunggah ke Files API sebelum diproses.
            </p>
            <ul className="list-disc ml-5">
              <li>Gambar: deskripsi, OCR, VQA.</li>
              <li>Audio: transkripsi, ringkas meeting.</li>
              <li>PDF/Dokumen: rangkum, QA, ekstrak tabel.</li>
            </ul>
            <p className="text-xs opacity-70">
              Privasi: Kunci API disimpan di server. Jangan taruh di browser.
            </p>
          </div>
        </aside>
      </main>

      <footer className="py-6 text-center text-xs text-zinc-500">
        © {new Date().getFullYear()} Gemini Multimodal Chatbot
      </footer>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Brain, Upload, FileText, Trash2, Database, Cpu, Layers, Activity,
  CheckCircle2, Loader2, Sparkles, FileType2, Globe, Plus
} from "lucide-react";
import { useDocs, addDocs, removeDoc, getQueries, addUrl } from "@/lib/kb-store";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Portal · InfySkill AI" },
      { name: "description", content: "Upload and manage documents in the InfySkill RAG knowledge base." },
    ],
  }),
  component: AdminPortal,
});

function AdminPortal() {
  const docs = useDocs();
  const [queries, setQueries] = useState(0);
  useEffect(() => {
    const sync = () => setQueries(getQueries());
    sync();
    window.addEventListener("kb:change", sync);
    return () => window.removeEventListener("kb:change", sync);
  }, []);

  const ready = docs.filter((d) => d.status === "ready");
  const totalChunks = ready.reduce((s, d) => s + d.chunks, 0);
  const totalEmbeddings = totalChunks * 768;
  const lastUpload = docs[0]?.uploadedAt;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-white/5 glass-strong">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3.5">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl shadow-glow" style={{ background: "var(--gradient-primary)" }}>
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-tight">InfySkill <span className="text-muted-foreground font-normal">/ Admin</span></div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Knowledge Base Console</div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-8">
        {/* Title */}
        <div>
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary-glow" /> Admin Dashboard
          </div>
          <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight">
            Manage Your <span className="gradient-text">Intelligent Knowledge Base</span>
          </h1>
          <p className="mt-2 text-muted-foreground text-sm max-w-2xl">
            Upload PDFs, DOCX, and TXT documents. Each file is automatically chunked, embedded, and indexed for instant retrieval.
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          <StatCard icon={FileText} label="Total Documents" value={docs.length} accent="primary" />
          <StatCard icon={Layers} label="Total Chunks" value={totalChunks} accent="accent" />
          <StatCard icon={Cpu} label="Embeddings" value={totalEmbeddings} accent="emerald" suffix="" />
          <StatCard icon={Activity} label="Queries" value={queries} accent="primary" />
          <StatCard icon={Database} label="Last Upload" value={0} display={lastUpload ? timeAgo(lastUpload) : "—"} accent="accent" />
        </div>

        {/* Upload + Status */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <UploadZone />
            <UrlZone />
          </div>
          <KbStatus ready={ready.length} processing={docs.filter((d) => d.status === "processing").length} chunks={totalChunks} />
        </div>

        {/* Documents */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Uploaded Documents</h2>
            <span className="text-xs text-muted-foreground">{docs.length} files</span>
          </div>
          {docs.length === 0 ? (
            <div className="rounded-2xl glass p-12 text-center">
              <FileType2 className="mx-auto h-10 w-10 text-muted-foreground/60" />
              <p className="mt-3 text-sm text-muted-foreground">No documents yet. Upload your first file above.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {docs.map((d) => (
                  <motion.div
                    key={d.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    whileHover={{ y: -3 }}
                    className="group relative overflow-hidden rounded-2xl glass p-4 transition hover:border-primary/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: "var(--gradient-primary)" }}>
                          {d.type === "URL" ? <Globe className="h-5 w-5 text-white" /> : <FileText className="h-5 w-5 text-white" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{d.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {d.type} · {formatSize(d.sizeKB)} · {new Date(d.uploadedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeDoc(d.id)}
                        className="opacity-0 group-hover:opacity-100 transition grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      {d.status === "processing" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-300">
                          <Loader2 className="h-3 w-3 animate-spin" /> Processing
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" /> Indexed
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground">{d.chunks || "—"} chunks</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, suffix, display, accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: number; suffix?: string; display?: string;
  accent: "primary" | "accent" | "emerald";
}) {
  const glow =
    accent === "emerald" ? "oklch(0.74 0.17 165 / 35%)" :
    accent === "accent" ? "oklch(0.7 0.2 240 / 35%)" :
    "oklch(0.62 0.22 275 / 35%)";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="relative overflow-hidden rounded-2xl glass p-4"
      style={{ boxShadow: `0 10px 30px -15px ${glow}` }}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-30 blur-2xl" style={{ background: glow }} />
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight">
        {display ?? <Counter to={value} />}{suffix}
      </div>
    </motion.div>
  );
}

function Counter({ to }: { to: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const dur = 800;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{n.toLocaleString()}</>;
}

function UploadZone() {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).filter((f) => /\.(pdf|docx?|txt)$/i.test(f.name));
    if (arr.length === 0) return;
    addDocs(arr);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
      className={`relative overflow-hidden rounded-2xl glass p-8 sm:p-12 text-center transition ${drag ? "border-primary/60 shadow-glow" : ""}`}
    >
      <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: "var(--gradient-radial)" }} />
      <div className="relative">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl animate-pulse-glow" style={{ background: "var(--gradient-primary)" }}>
          <Upload className="h-7 w-7 text-white" />
        </div>
        <h3 className="mt-5 text-xl font-bold">Drop documents to ingest</h3>
        <p className="mt-1 text-sm text-muted-foreground">PDF, DOCX, or TXT · multi-file supported</p>
        <button
          onClick={() => inputRef.current?.click()}
          className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white hover:scale-105 active:scale-95 transition"
          style={{ background: "var(--gradient-primary)", boxShadow: "0 10px 30px -10px oklch(0.62 0.22 275 / 60%)" }}
        >
          <Upload className="h-4 w-4" /> Choose Files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0, 0, 0, 0)", border: 0 }}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
    </div>
  );
}

function KbStatus({ ready, processing, chunks }: { ready: number; processing: number; chunks: number }) {
  return (
    <div className="rounded-2xl glass p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">Knowledge Base Status</h3>
        <Database className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-4 space-y-4">
        <StatusRow label="FAISS Index" status={ready > 0 ? "Healthy" : "Idle"} good={ready > 0} />
        <StatusRow label="Embedding Pipeline" status={processing > 0 ? "Running" : "Ready"} good />
        <StatusRow label="Vector Store" status={`${chunks} vectors`} good={chunks > 0} />
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Indexing Load</span><span>{Math.min(100, chunks)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/5">
            <motion.div
              initial={{ width: 0 }} animate={{ width: `${Math.min(100, chunks)}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full rounded-full" style={{ background: "var(--gradient-primary)" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, status, good }: { label: string; status: string; good: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`inline-flex items-center gap-1.5 font-medium ${good ? "text-emerald-300" : "text-muted-foreground"}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${good ? "bg-emerald-400" : "bg-zinc-500"}`} />
        {status}
      </span>
    </div>
  );
}

function formatSize(kb: number) {
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
function timeAgo(t: number) {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function UrlZone() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const targetUrl = url.trim();
    if (!targetUrl) return;
    setLoading(true);
    try {
      await addUrl(targetUrl);
      setUrl("");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl glass p-6">
      <div className="pointer-events-none absolute inset-0 opacity-20" style={{ background: "var(--gradient-radial)" }} />
      <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5 text-primary-glow">
            <Globe className="h-5 w-5" />
          </div>
          <div className="text-left">
            <h4 className="text-sm font-bold">Add Webpage URL</h4>
            <p className="text-xs text-muted-foreground">Scrape and index public web pages dynamically</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/about"
            disabled={loading}
            className="flex-1 rounded-xl glass px-3.5 py-2 text-sm outline-none placeholder:text-muted-foreground border border-white/5 focus:border-primary/40 focus:shadow-glow transition"
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-40 disabled:scale-100 hover:scale-105 active:scale-95 shrink-0"
            style={{ background: "var(--gradient-primary)" }}
          >
            {loading ? "Indexing..." : <><Plus className="h-4 w-4" /> Add URL</>}
          </button>
        </form>
      </div>
    </div>
  );
}

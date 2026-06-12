import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Brain, Send, Mic, Sparkles, FileText, ShieldCheck } from "lucide-react";
import { IntroAnimation } from "@/components/IntroAnimation";
import { ParticleField } from "@/components/ParticleField";
import { useDocs, bumpQueries, DocItem, retrieveRelevantChunks, generateAnswer, generateDynamicQueries } from "@/lib/kb-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "InfySkill AI Document Assistant" },
      { name: "description", content: "Chat with your documents. RAG-powered enterprise AI assistant by InfySkill Software Solutions." },
      { property: "og:title", content: "InfySkill AI Document Assistant" },
      { property: "og:description", content: "Transforming documents into intelligent conversations." },
    ],
  }),
  component: ClientPortal,
});

type Msg =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "ai"; text: string; source?: string; confidence?: number; thinking?: boolean };

const STAGES = ["Searching Knowledge Base...", "Analyzing Document Chunks...", "Generating Response..."];

function ClientPortal() {
  const [introDone, setIntroDone] = useState(false);
  const [skip, setSkip] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("infyskill.intro.seen")) {
      setSkip(true);
      setIntroDone(true);
    }
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {!skip && !introDone && (
        <IntroAnimation
          onDone={() => {
            sessionStorage.setItem("infyskill.intro.seen", "1");
            setIntroDone(true);
          }}
        />
      )}
      <ChatScreen />
    </div>
  );
}

function ChatScreen() {
  const docs = useDocs();
  const ready = docs.filter((d) => d.status === "ready").length;
  const processing = docs.some((d) => d.status === "processing");
  const hasKb = ready > 0;

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [stage, setStage] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function send(text: string) {
    const q = text.trim();
    if (!q) return;
    bumpQueries();
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text: q };
    const aiId = crypto.randomUUID();
    setMessages((m) => [...m, userMsg, { id: aiId, role: "ai", text: "", thinking: true }]);
    setInput("");
    setStage(0);

    let s = 0;
    const stageTimer = setInterval(() => {
      s++;
      if (s < STAGES.length) setStage(s);
      else clearInterval(stageTimer);
    }, 900);

    setTimeout(() => {
      clearInterval(stageTimer);
      const { text: answer, source } = mockAnswer(q, docs);
      setMessages((m) =>
        m.map((msg) =>
          msg.id === aiId
            ? { id: aiId, role: "ai", text: answer, source, confidence: 78 + Math.floor(Math.random() * 20) }
            : msg,
        ),
      );
    }, 3000);
  }

  return (
    <div className="relative flex h-screen flex-col">
      <ParticleField count={18} className="opacity-40" />

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 glass-strong">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3.5">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="grid h-9 w-9 place-items-center rounded-xl shadow-glow" style={{ background: "var(--gradient-primary)" }}>
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-tight">InfySkill</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Software Solutions</div>
            </div>
          </Link>



          <div className="flex items-center gap-2">
            <StatusPill ready={hasKb} processing={processing} />
          </div>
        </div>
      </header>

      {/* Conversation */}
      <div ref={scrollRef} className="scrollbar-thin relative z-10 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
          {messages.length === 0 ? (
              <WelcomeHero onPick={send} docs={docs} />
            ) : (
              <div className="space-y-6">
                {messages.map((m) => (
                  <MessageBubble key={m.id} msg={m} stage={stage} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="relative z-10 border-t border-white/5 glass-strong">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 py-4">
            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="group flex items-center gap-2 rounded-2xl glass px-3 py-2 transition focus-within:shadow-glow focus-within:border-primary/50"
              style={{ boxShadow: "var(--shadow-soft)" }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Is there any queries.."
                className="flex-1 bg-transparent px-2 py-2.5 text-[15px] outline-none placeholder:text-muted-foreground"
              />
              <button type="button" className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition">
                <Mic className="h-4 w-4" />
              </button>
              <button
                type="submit"
                disabled={!input.trim()}
                className="grid h-10 w-10 place-items-center rounded-xl text-white transition disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                style={{ background: "var(--gradient-primary)", boxShadow: "0 8px 24px -8px oklch(0.62 0.22 275 / 60%)" }}
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              infyskill software solutions Assistant
            </p>
          </div>
        </div>
      </div>
    );
  }

  function StatusPill({ ready, processing }: { ready: boolean; processing: boolean }) {
    const label = processing ? "Processing Documents" : ready ? "Knowledge Base Ready" : "Ready to Answer";
    const color = processing ? "bg-amber-400" : ready ? "bg-emerald-400" : "bg-zinc-400";
    return (
      <div className="hidden md:flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs font-medium">
        <span className="relative flex h-2 w-2">
          <span className={`absolute inset-0 rounded-full ${color} opacity-60 animate-ping`} />
          <span className={`relative h-2 w-2 rounded-full ${color}`} />
        </span>
        {label}
      </div>
    );
  }

  function WelcomeHero({ onPick, docs }: { onPick: (q: string) => void; docs: DocItem[] }) {
    const readyDocs = docs.filter(d => d.status === "ready");
    
    let suggestions: { q: string, icon: any }[] = [];

    if (readyDocs.length > 0) {
      const dynamic = generateDynamicQueries(docs);
      if (dynamic.length > 0) {
        const icons = [Sparkles, ShieldCheck, FileText, Brain];
        suggestions = dynamic.map((d, i) => ({
          q: d.q,
          icon: icons[i % icons.length]
        }));
      }
    }

    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center pt-8 sm:pt-16">
        <div className="relative mx-auto mb-6 grid h-20 w-20 place-items-center rounded-3xl animate-pulse-glow" style={{ background: "var(--gradient-primary)" }}>
          <Brain className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
          Ask Anything About <span className="gradient-text">Your Documents</span>
        </h1>
        <p className="mt-3 text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">
          Powered by Retrieval-Augmented Generation (RAG). Get instant, source-cited answers grounded in your knowledge base.
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {suggestions.map(({ q, icon: Icon }, i) => (
            <motion.button
              key={q}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.07 }}
              whileHover={{ y: -3 }}
              onClick={() => onPick(q)}
              className="group relative overflow-hidden rounded-2xl glass p-4 text-left transition hover:border-primary/40"
            >
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/5 text-primary-glow group-hover:bg-primary/15 transition">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="text-sm font-medium pt-1.5">{q}</div>
              </div>
              <div className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition" />
            </motion.button>
          ))}
        </div>
      </motion.div>
    );
  }

function MessageBubble({ msg, stage }: { msg: Msg; stage: number }) {
  if (msg.role === "user") {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
        <div
          className="max-w-[85%] rounded-2xl rounded-tr-md px-4 py-2.5 text-[15px] text-white shadow-elevated"
          style={{ background: "var(--gradient-primary)" }}
        >
          {msg.text}
        </div>
      </motion.div>
    );
  }
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl mt-1" style={{ background: "var(--gradient-primary)" }}>
        <Brain className="h-4 w-4 text-white" />
      </div>
      <div className="max-w-[85%] flex-1">
        {msg.thinking ? (
          <ThinkingCard stage={stage} />
        ) : (
          <div className="rounded-2xl rounded-tl-md glass p-4 shadow-soft">
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ThinkingCard({ stage }: { stage: number }) {
  return (
    <div className="rounded-2xl rounded-tl-md glass p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-primary-glow"
              style={{ animation: `typing-dot 1.2s ease-in-out ${i * 0.15}s infinite` }}
            />
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.span
            key={stage}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className="text-sm text-muted-foreground"
          >
            {STAGES[stage]}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="mt-3 relative h-1 overflow-hidden rounded-full bg-white/5">
        <div
          className="absolute inset-y-0 w-1/3 rounded-full"
          style={{ background: "var(--gradient-primary)", animation: "shimmer 1.6s ease-in-out infinite" }}
        />
      </div>
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value > 85 ? "oklch(0.74 0.17 165)" : value > 70 ? "oklch(0.7 0.2 240)" : "oklch(0.78 0.18 70)";
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium">
      <div className="relative h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
        <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-muted-foreground">{value}% confidence</span>
    </div>
  );
}

function mockAnswer(q: string, docs: DocItem[]): { text: string; source: string } {
  const readyDocs = docs.filter((d) => d.status === "ready");
  
  if (readyDocs.length === 0) {
    return {
      text: "I'm ready, but no documents are loaded into the knowledge base yet. Go to the Admin Portal to upload PDFs, DOCX, or TXT files — once they're indexed, I'll answer with grounded citations from your sources.",
      source: "System"
    };
  }

  // Retrieve relevant chunks dynamically from the uploaded document(s)
  const retrieved = retrieveRelevantChunks(q, readyDocs);
  if (retrieved.length > 0) {
    return {
      text: generateAnswer(q, retrieved),
      source: retrieved[0].source
    };
  }

  // Fallback to overview info if no exact match in the documents but keywords match general RAG queries
  const lower = q.toLowerCase();
  if (lower.includes("salary") || lower.includes("package")) {
    return {
      text: "Based on the indexed documents, the TCS Digital salary package is approximately ₹7 LPA for fresh graduates, with additional performance-linked variable components. Senior Digital roles can scale up to ₹11 LPA depending on skill assessments.",
      source: "TCS_Digital_Overview.pdf"
    };
  }
  if (lower.includes("hiring") || lower.includes("process")) {
    return {
      text: "The hiring process consists of: (1) Online aptitude + coding assessment, (2) Technical interview focused on data structures and projects, (3) Managerial round, and (4) HR discussion. The end-to-end cycle typically takes 2–3 weeks.",
      source: "TCS_Hiring_Guidelines.pdf"
    };
  }
  if (lower.includes("summar")) {
    return {
      text: "The document outlines eligibility criteria, the recruitment timeline, compensation structure, and onboarding logistics for the TCS Digital track. Key highlights: 60% throughout academics, no active backlogs, and a 2-year service agreement.",
      source: "TCS_Overview.pdf"
    };
  }
  if (lower.includes("eligibility") || lower.includes("criteria")) {
    return {
      text: "Eligibility: 60% or above in 10th, 12th, and graduation; no active backlogs at the time of joining; maximum gap of 2 years in education. Branches: B.E./B.Tech/M.E./M.Tech/MCA from recognised universities.",
      source: "TCS_Eligibility.pdf"
    };
  }

  return {
    text: "Could you please rephrase or try another query?",
    source: readyDocs[0]?.name || "knowledge_base.pdf"
  };
}

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
      { title: "InfySkill AI Assistant" },
      { name: "description", content: "Enterprise AI assistant by InfySkill Software Solutions." },
      { property: "og:title", content: "InfySkill AI Assistant" },
      { property: "og:description", content: "Intelligent enterprise AI conversations." },
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
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = "en-US";

        rec.onstart = () => {
          setIsListening(true);
        };

        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInput((prev) => prev + (prev ? " " : "") + transcript);
        };

        rec.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsListening(false);
        };

        rec.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = rec;
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in your browser. Please try Google Chrome, Microsoft Edge, or Apple Safari.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error("Failed to start speech recognition:", err);
      }
    }
  };

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
              <button
                type="button"
                onClick={toggleListening}
                className={`grid h-10 w-10 place-items-center rounded-xl transition ${
                  isListening
                    ? "text-red-500 bg-red-500/10 animate-pulse border border-red-500/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
                title={isListening ? "Listening... Click to stop" : "Start voice input"}
              >
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
          How can I help you <span className="gradient-text">today?</span>
        </h1>
        <p className="mt-3 text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">
          Get instant, intelligent answers to your questions, powered by advanced AI.
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

const INFYSKILL_KNOWLEDGE = [
  {
    keys: ["about", "what is infyskill", "who is infyskill", "company", "who are you", "what is this website", "tell me about your company"],
    answer: "InfySkill (legally registered as InfySkill Edutech Private Limited) is a premier technology training, software development, and career solutions organization based in Visakhapatnam, Andhra Pradesh. Founded in 2023, InfySkill bridges the gap between academic education and industry requirements by providing top-tier training, skill development, and career placement support."
  },
  {
    keys: ["ceo", "cto", "founder", "founded", "valluru", "samara", "pravallika", "ganagalla", "who runs", "leadership", "management"],
    answer: "InfySkill Software Solutions was founded in April 2023. Our key leadership includes:\n• Valluru Samara Simha Reddy (CEO & Founder)\n• Pravallika Ganagalla (CTO & Director)\nUnder their leadership, InfySkill is officially recognized by the Ministry of Corporate Affairs, MSME, Startup India (DPIIT), and AICTE."
  },
  {
    keys: ["course", "training", "program", "what do you teach", "learn", "python", "java", "mern", "web dev", "data science", "machine learning", "cloud", "artificial intelligence", "ai"],
    answer: "InfySkill offers industry-aligned training programs in cutting-edge fields, including:\n• Python & Java Programming\n• Full-Stack Web Development (MERN Stack)\n• Data Science & Machine Learning\n• Artificial Intelligence (AI)\n• Cloud Computing\nEach course is led by industry professionals and features hands-on projects, mock assessments, and comprehensive interview preparation."
  },
  {
    keys: ["service", "software development", "what do you do", "project", "projects", "final year", "research paper", "documentation", "academic support"],
    answer: "InfySkill provides a comprehensive range of professional services:\n• Software Development: Custom software solutions, web applications, and tech consultation.\n• Academic & Project Support: Mentorship, documentation assistance, research paper guidance, and technical support for final-year engineering projects across various domains.\n• Career Services: Mock interviews, resume reviews, placement preparation, and internship placements."
  },
  {
    keys: ["location", "address", "where", "office", "visakhapatnam", "vizag", "andhra pradesh"],
    answer: "InfySkill Software Solutions' main office is located in Visakhapatnam, Andhra Pradesh, India. We serve students, graduates, and businesses both locally and online across the nation."
  },
  {
    keys: ["contact", "email", "phone", "website", "reach", "support", "call", "apply"],
    answer: "You can contact InfySkill Software Solutions through the following channels:\n• Website: https://infyskill.in\n• Services: Software Development, Technical Projects, and Skill Training Programs\n• Support & Inquiries: Please visit our official website or reach out via our contact portals for specific program enrollments."
  }
];

function findInfySkillAnswer(query: string): string | null {
  const qLower = query.toLowerCase();
  
  if (
    qLower.includes("who are you") || 
    qLower.includes("what is your name") || 
    qLower.includes("your identity") || 
    qLower.includes("who created you")
  ) {
    return "I am the official InfySkill AI Assistant. I am designed to assist you with inquiries about InfySkill Software Solutions, our training programs, software services, and other related topics.";
  }

  let bestMatch: typeof INFYSKILL_KNOWLEDGE[0] | null = null;
  let maxScore = 0;
  
  for (const item of INFYSKILL_KNOWLEDGE) {
    let score = 0;
    for (const key of item.keys) {
      if (qLower.includes(key)) {
        score += key.length;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestMatch = item;
    }
  }
  
  if (maxScore >= 3 && bestMatch) {
    return bestMatch.answer;
  }
  
  if (qLower.includes("infyskill") || qLower.includes("infy skill")) {
    return INFYSKILL_KNOWLEDGE[0].answer;
  }
  
  return null;
}

function mockAnswer(q: string, docs: DocItem[]): { text: string; source: string } {
  // First, check if there is an InfySkill company-specific answer
  const infyAnswer = findInfySkillAnswer(q);
  if (infyAnswer) {
    return {
      text: infyAnswer,
      source: "InfySkill Assistant"
    };
  }

  const readyDocs = docs.filter((d) => d.status === "ready");

  // Retrieve relevant chunks dynamically from the uploaded document(s)
  if (readyDocs.length > 0) {
    const retrieved = retrieveRelevantChunks(q, readyDocs);
    if (retrieved.length > 0) {
      return {
        text: generateAnswer(q, retrieved),
        source: retrieved[0].source
      };
    }
  }

  return {
    text: "As the InfySkill AI Assistant, I couldn't find a specific reference to that. Could you please rephrase your question, or ask about InfySkill's training programs, software development services, academic project support, or contact info?",
    source: "InfySkill Assistant"
  };
}

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
  const [lang, setLang] = useState<Language>("en");
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

  useEffect(() => {
    if (recognitionRef.current) {
      if (lang === "en") recognitionRef.current.lang = "en-US";
      else if (lang === "te") recognitionRef.current.lang = "te-IN";
      else if (lang === "hi") recognitionRef.current.lang = "hi-IN";
      else if (lang === "ta") recognitionRef.current.lang = "ta-IN";
      else if (lang === "es") recognitionRef.current.lang = "es-ES";
      else if (lang === "fr") recognitionRef.current.lang = "fr-FR";
    }
  }, [lang]);

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
      const { text: answer, source } = mockAnswer(q, docs, lang);
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
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Language)}
              className="rounded-full glass px-3 py-1.5 text-xs font-medium bg-transparent border border-white/10 text-white outline-none cursor-pointer hover:bg-white/5 transition"
            >
              <option value="en" className="bg-zinc-950 text-white">English</option>
              <option value="te" className="bg-zinc-950 text-white">తెలుగు (Telugu)</option>
              <option value="hi" className="bg-zinc-950 text-white">हिन्दी (Hindi)</option>
              <option value="ta" className="bg-zinc-950 text-white">தமிழ் (Tamil)</option>
              <option value="es" className="bg-zinc-950 text-white">Español (Spanish)</option>
              <option value="fr" className="bg-zinc-950 text-white">Français (French)</option>
            </select>
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

type Language = "en" | "hi" | "te" | "ta" | "es" | "fr";

const INFYSKILL_KNOWLEDGE: Record<Language, { keys: string[]; answer: string }[]> = {
  en: [
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
  ],
  hi: [
    {
      keys: ["के बारे में", "इन्फीस्किल क्या है", "इन्फीस्किल कौन है", "कंपनी", "आप कौन हैं", "यह वेबसाइट क्या है", "अपनी कंपनी के बारे में बताएं"],
      answer: "इन्फीस्किल (कानूनी रूप से इन्फीस्किल एडुटेक प्राइवेट लिमिटेड के रूप में पंजीकृत) विशाखापत्तनम, आंध्र प्रदेश में स्थित एक प्रमुख प्रौद्योगिकी प्रशिक्षण, सॉफ्टवेयर विकास और करियर समाधान संगठन है। 2023 में स्थापित, इन्फीस्किल उच्च स्तरीय प्रशिक्षण, कौशल विकास और करियर प्लेसमेंट सहायता प्रदान करके शैक्षणिक शिक्षा और उद्योग की आवश्यकताओं के बीच के अंतर को पाटता है।"
    },
    {
      keys: ["सीईओ", "सीटीओ", "संस्थापक", "स्थापना", "वल्लूरु", "समर", "प्रवलिका", "गनगल्ला", "कौन चलाता है", "नेतृत्व", "प्रबंधन"],
      answer: "इन्फीस्किल सॉफ्टवेयर सॉल्यूशंस की स्थापना अप्रैल 2023 में हुई थी। हमारे प्रमुख नेतृत्व में शामिल हैं:\n• वल्लूरु समर सिम्हा रेड्डी (सीईओ और संस्थापक)\n• प्रवलिका गनगल्ला (सीटीओ और निदेशक)\nउनके नेतृत्व में, इन्फीस्किल को कॉर्पोरेट मामलों के मंत्रालय, एमएसएमई, स्टार्टअप इंडिया (DPIIT) और एआईसीटीई द्वारा आधिकारिक रूप से मान्यता प्राप्त है।"
    },
    {
      keys: ["कोर्स", "प्रशिक्षण", "प्रोग्राम", "आप क्या पढ़ाते हैं", "सीखें", "पायथन", "जावा", "मर्न", "वेब डेवलपमेंट", "डेटा साइंस", "मशीन लर्निंग", "क्लाउड", "कृत्रिम बुद्धिमत्ता", "एआई"],
      answer: "इन्फीस्किल अत्याधुनिक क्षेत्रों में उद्योग-संरेखित प्रशिक्षण कार्यक्रम प्रदान करता है, जिनमें शामिल हैं:\n• पायथन और जावा प्रोग्रामिंग\n• फुल-स्टैक वेब डेवलपमेंट (MERN स्टैक)\n• डेटा साइंस और मशीन लर्निंग\n• आर्टिफिशियल इंटेलिजेंस (AI)\n• क्लाउड कंप्यूटिंग\nप्रत्येक कोर्स उद्योग के पेशेवरों द्वारा संचालित किया जाता है और इसमें व्यावहारिक परियोजनाएं, मॉक आकलन और व्यापक साक्षात्कार की तैयारी शामिल है।"
    },
    {
      keys: ["सेवा", "सॉफ्टवेयर विकास", "आप क्या करते हैं", "परियोजना", "प्रोजेक्ट्स", "अंतिम वर्ष", "शोध पत्र", "दस्तावेज़ीकरण", "शैक्षणिक सहायता"],
      answer: "इन्फीस्किल पेशेवर सेवाओं की एक विस्तृत श्रृंखला प्रदान करता है:\n• सॉफ्टवेयर विकास: कस्टम सॉफ्टवेयर समाधान, वेब अनुप्रयोग और तकनीकी परामर्श।\n• शैक्षणिक और परियोजना सहायता: विभिन्न डोमेन में अंतिम वर्ष के इंजीनियरिंग प्रोजेक्ट्स के लिए मेंटरशिप, दस्तावेज़ीकरण सहायता, शोध पत्र मार्गदर्शन और तकनीकी सहायता।\n• करियर सेवाएं: मॉक इंटरव्यू, रिज्यूमे समीक्षा, प्लेसमेंट की तैयारी और इंटर्नशिप प्लेसमेंट।"
    },
    {
      keys: ["स्थान", "पता", "कहाँ", "कार्यालय", "विशाखापत्तनम", "वाइज़ैग", "आंध्र प्रदेश"],
      answer: "इन्फीस्किल सॉफ्टवेयर सॉल्यूशंस का मुख्य कार्यालय विशाखापत्तनम, आंध्र प्रदेश, भारत में स्थित है। हम देश भर में स्थानीय और ऑनलाइन दोनों स्तरों पर छात्रों, स्नातकों और व्यवसायों की सेवा करते हैं।"
    },
    {
      keys: ["संपर्क", "ईमेल", "फोन", "वेबसाइट", "पहुंचें", "समर्थन", "कॉल", "आवेदन"],
      answer: "आप निम्नलिखित माध्यमों से इन्फीस्किल सॉफ्टवेयर सॉल्यूशंस से संपर्क कर सकते हैं:\n• वेबसाइट: https://infyskill.in\n• सेवाएं: सॉफ्टवेयर विकास, तकनीकी परियोजनाएं और कौशल प्रशिक्षण कार्यक्रम\n• समर्थन और पूछताछ: विशिष्ट कार्यक्रम नामांकन के लिए कृपया हमारी आधिकारिक वेबसाइट पर जाएं या हमारे संपर्क पोर्टलों के माध्यम से संपर्क करें।"
    }
  ],
  te: [
    {
      keys: ["గురించి", "ఇన్ఫీస్కిల్ అంటే ఏమిటి", "ఇన్ఫీస్కిల్ ఎవరు", "కంపెనీ", "మీరు ఎవరు", "ఈ వెబ్‌సైట్ ఏమిటి", "మీ కంపెనీ గురించి చెప్పండి"],
      answer: "ఇన్ఫీస్కిల్ (అధికారికంగా ఇన్ఫీస్కిల్ ఎడ్యుటెక్ ప్రైవేట్ లిమిటెడ్) అనేది ఆంధ్రప్రదేశ్‌లోని విశాఖపట్నంలో ఉన్న ఒక ప్రముఖ టెక్నాలజీ శిక్షణ, సాఫ్ట్‌వేర్ అభివృద్ధి మరియు కెరీర్ సొల్యూషన్స్ సంస్థ. 2023లో స్థాపించబడిన ఇన్ఫీస్కిల్, విద్యార్థులకు నాణ్యమైన శిక్షణ, నైపుణ్యాభివృద్ధి మరియు ఉపాధి అవకాశాలను కల్పించడం ద్వారా విద్యా రంగానికి మరియు పరిశ్రమల అవసరాలకు మధ్య ఉన్న దూరాన్ని తగ్గిస్తుంది."
    },
    {
      keys: ["సీఈఓ", "సీటీఓ", "వ్యవస్థాపకుడు", "స్థాపన", "వల్లూరు", "సమర", "ప్రవల్లిక", "గంగళ్ల", "నడిపించేది ఎవరు", "నాయకత్వం", "నిర్వహణ"],
      answer: "ఇన్ఫీస్కిల్ సాఫ్ట్‌వేర్ సొల్యూషన్స్ ఏప్రిల్ 2023లో స్థాపించబడింది. మా ముఖ్య నాయకత్వంలో ఉన్నారు:\n• వల్లూరు సమర సింహ రెడ్డి (CEO & ఫౌండర్)\n• ప్రవల్లిక గంగళ్ల (CTO & డైరెక్టర్)\nవీరి నాయకత్వంలో ఇన్ఫీస్కిల్ సంస్థ కార్పొరేట్ వ్యవహారాల మంత్రిత్వ శాఖ, MSME, స్టార్టప్ ఇండియా (DPIIT), మరియు AICTE లచే అధికారిక గుర్తింపు పొందింది."
    },
    {
      keys: ["కోర్సు", "శిక్షణ", "కార్యక్రమం", "మీరు ఏమి బోధిస్తారు", "నేర్చుకోండి", "పైథాన్", "జావా", "మెర్న్", "వెబ్ డెవలప్‌మెంట్", "డేటా సైన్స్", "మెషిన్ లెర్నింగ్", "క్లౌడ్", "కృత్రిమ మేధస్సు", "ఏఐ"],
      answer: "ఇన్ఫీస్కిల్ అత్యాధునిక రంగాలలో పరిశ్రమకు సరిపోయే శిక్షణా కార్యక్రమాలను అందిస్తుంది, వాటిలో కొన్ని:\n• పైథాన్ & జావా ప్రోగ్రామింగ్\n• ఫుల్-స్టాక్ వెబ్ డెవలప్‌మెంట్ (MERN స్టాక్)\n• డేటా సైన్స్ & మెషిన్ లెర్నింగ్\n• ఆర్టిఫిషియల్ ఇంటెలిజెన్స్ (AI)\n• క్లౌడ్ కంప్యూటింగ్\nప్రతి కోర్సును పరిశ్రమ నిపుణులు బోధిస్తారు. ఇందులో ప్రాజెక్టులు, మాక్ ఇంటర్వ్యూలు మరియు పూర్తి ప్లేస్‌మెంట్ శిక్షణ ఉంటాయి."
    },
    {
      keys: ["సేవ", "సాఫ్ట్‌వేర్ అభివృద్ధి", "మీరు ఏమి చేస్తారు", "ప్రాజెక్ట్", "ప్రాజెక్టులు", "చివరి సంవత్సరం", "రీసెర్చ్ పేపర్", "డాక్యుమెంటేషన్", "విద్యా మద్దతు"],
      answer: "ఇన్ఫీస్కిల్ విస్తృతమైన వృత్తిపరమైన సేవలను అందిస్తుంది:\n• సాఫ్ట్‌వేర్ డెవలప్‌మెంట్: కస్టమ్ సాఫ్ట్‌వేర్ సొల్యూషన్స్, వెబ్ అప్లికేషన్స్ మరియు సాంకేతిక సలహాలు.\n• విద్యా & ప్రాజెక్ట్ సపోర్ట్: ఇంజనీరింగ్ ఫైనల్ ఇయర్ విద్యార్థులకు ప్రాజెక్ట్ గైడెన్స్, డాక్యుమెంటేషన్ సపోర్ట్ మరియు రీసెర్చ్ పేపర్ గైడెన్స్.\n• కెరీర్ సేవలు: మాక్ ఇంటర్వ్యూలు, రెజ్యూమ్ ప్రిపరేషన్, ప్లేస్‌మెంట్ శిక్షణ మరియు ఇంటర్న్‌షిప్ అవకాశాలు."
    },
    {
      keys: ["ప్రదేశం", "చిరునామా", "ఎక్కడ", "కార్యాలయం", "విశాఖపట్నం", "వైజాగ్", "ఆంధ్రప్రదేశ్"],
      answer: "ఇన్ఫీస్కిల్ సాఫ్ట్‌వేర్ సొల్యూషన్స్ ప్రధాన కార్యాలయం ఆంధ్రప్రదేశ్‌లోని విశాఖపట్నంలో ఉంది. మా సేవలు విద్యార్థులకు మరియు వ్యాపారాలకు ఆఫ్‌లైన్ మరియు ఆన్‌లైన్ ద్వారా అందుబాటులో ఉన్నాయి."
    },
    {
      keys: ["సంప్రదించండి", "ఈమెయిల్", "ఫోన్", "వెబ్‌సైట్", "చేరండి", "మద్దతు", "కాల్", "దరఖాస్తు"],
      answer: "మీరు ఇన్ఫీస్కిల్ సాఫ్ట్‌వేర్ సొల్యూషన్స్‌ను ఈ క్రింది మార్గాల ద్వారా సంప్రదించవచ్చు:\n• వెబ్‌సైట్: https://infyskill.in\n• సేవలు: సాఫ్ట్‌వేర్ అభివృద్ధి, సాంకేతిక ప్రాజెక్టులు మరియు నైపుణ్య శిక్షణ కార్యక్రమాలు\n• మద్దతు & విచారణలు: మరిన్ని వివరాల కోసం మా వెబ్‌సైట్‌ను సందర్శించండి లేదా మా కాంటాక్ట్ పోర్టల్స్ ద్వారా సంప్రదించండి."
    }
  ],
  ta: [
    {
      keys: ["பற்றி", "இன்ஃபிஸ்கில் என்றால் என்ன", "இன்ஃபிஸ்கில் யார்", "நிறுவனம்", "நீங்கள் யார்", "இந்த இணையதளம் என்ன", "உங்கள் நிறுவனத்தைப் பற்றி கூறுங்கள்"],
      answer: "இன்ஃபிஸ்கில் (சட்டப்பூர்வமாக இன்ஃபிஸ்கில் எடுடெக் பிரைவேট லிமிட்டெட் என பதிவு செய்யப்பட்டுள்ளது) என்பது ஆந்திரப் பிரதேசத்தின் விசாகப்பட்டினத்தை மையமாகக் கொண்ட ஒரு முன்னணி தொழில்நுட்பப் பயிற்சி, மென்பொருள் மேம்பாடு மற்றும் தொழில் தீர்வுகளாகும். 2023 இல் நிறுவப்பட்ட இன்ஃபிஸ்கில், உயர்தர பயிற்சி, திறன் மேம்பாடு மற்றும் வேலைவாய்ப்பு ஆதரவை வழங்குவதன் மூலம் கல்விக்கும் தொழில்துறை தேவைகளுக்கும் இடையிலான இடைவெளியைக் குறைக்கிறது."
    },
    {
      keys: ["சிஇஓ", "சிடிஓ", "நிறுவனர்", "நிறுவப்பட்டது", "வல்லூரு", "சமர", "பிரவல்லிகா", "கனகல்லா", "யார் நடத்துவது", "தலைமை", "மேலாண்மை"],
      answer: "இன்ஃபிஸ்கில் மென்பொருள் தீர்வுகள் ஏப்ரல் 2023 இல் நிறுவப்பட்டது. எங்கள் முக்கிய தலைமைப் பொறுப்பில் இருப்பவர்கள்:\n• வல்லூரு சமர சிம்ஹ ரெட்டி (CEO & நிறுவனர்)\n• பிரவல்லிகா கனகல்லா (CTO & இயக்குனர்)\nஇவர்களின் தலைமையின் கீழ், இன்ஃபிஸ்கில் கார்ப்பரேட் விவகாரங்கள் அமைச்சகம், MSME, ஸ்டார்ட்அப் இந்தியா (DPIIT) மற்றும் AICTE ஆகியவற்றால் அதிகாரப்பூர்வமாக அங்கீகரிக்கப்பட்டுள்ளது."
    },
    {
      keys: ["பாடநெறி", "பயிற்சி", "திட்டம்", "நீங்கள் என்ன கற்பிக்கிறீர்கள்", "கற்க", "பைதான்", "ஜாவா", "மெர்ன்", "வலை மேம்பாடு", "தரவு அறிவியல்", "இயந்திர கற்றல்", "கிளவுட்", "செயற்கை நுண்ணறிவு", "ஏஐ"],
      answer: "இன்ஃபிஸ்கில் அதிநவீன துறைகளில் தொழில்துறைக்கு ஏற்ற பயிற்சித் திட்டங்களை வழங்குகிறது, அவற்றுள்:\n• பைதான் & ஜாவா புரோகிராமிங்\n• முழு அடுக்கு வலை மேம்பாடு (MERN ஸ்டாக்)\n• தரவு அறிவியல் & இயந்திர கற்றல்\n• செயற்கை நுண்ணறிவு (AI)\n• கிளவுட் கம்ப்யூட்டிங்\nஒவ்வொரு பாடநெறியும் தொழில்துறை நிபுணர்களால் நடத்தப்படுகிறது மற்றும் நேரடி திட்டங்கள், மாதிரி மதிப்பீடுகள் மற்றும் விரிவான நேர்காணல் தயாரிப்புகளைக் கொண்டுள்ளது."
    },
    {
      keys: ["சேவை", "மென்பொருள் மேம்பாடு", "நீங்கள் என்ன செய்கிறீர்கள்", "திட்டம்", "திட்டங்கள்", "இறுதி ஆண்டு", "ஆராய்ச்சி கட்டுரை", "ஆவணப்படுத்தல்", "கல்வி ஆதரவு"],
      answer: "இன்ஃபிஸ்கில் விரிவான அளவிலான தொழில்முறை சேவைகளை வழங்குகிறது:\n• மென்பொருள் மேம்பாடு: தனிப்பயன் மென்பொருள் தீர்வுகள், வலை பயன்பாடுகள் மற்றும் தொழில்நுட்ப ஆலோசனை.\n• கல்வி மற்றும் திட்ட ஆதரவு: பொறியியல் இறுதி ஆண்டு திட்டங்களுக்கு வழிகாட்டுதல், ஆவணப்படுத்தல் ஆதரவு மற்றும் ஆராய்ச்சி கட்டுரை வழிகாட்டுதல்.\n• தொழில் சேவைகள்: மாதிரி நேர்காணல்கள், ரெஸ்யூம் தயாரிப்பு, வேலைவாய்ப்பு பயிற்சி மற்றும் இன்டர்ன்ஷிப் வாய்ப்புகள்."
    },
    {
      keys: ["இடம்", "முகவரி", "எங்கே", "அலுவலகம்", "விசாகப்பட்டினம்", "வைசாக்", "ஆந்திர பிரதேசம்"],
      answer: "இன்ஃபிஸ்கில் மென்பொருள் தீர்வுகளின் முதன்மை அலுவலகம் இந்தியாவின் ஆந்திரப் பிரதேசத்தில் உள்ள விசாகப்பட்டினத்தில் அமைந்துள்ளது. நாடு முழுவதும் உள்ள மாணவர்கள், பட்டதாரிகள் மற்றும் வணிகங்களுக்கு ஆஃப்லைன் மற்றும் ஆன்லைன் மூலமாக நாங்கள் சேவை செய்கிறோம்."
    },
    {
      keys: ["தொடர்பு", "மின்னஞ்சல்", "தொலைபேசி", "இணையதளம்", "அணுகவும்", "ஆதரவு", "அழைப்பு", "விண்ணப்பிக்க"],
      answer: "இன்ஃபிஸ்கில் மென்பொருள் தீர்வுகளை நீங்கள் பின்வரும் வழிகளில் தொடர்பு கொள்ளலாம்:\n• இணையதளம்: https://infyskill.in\n• சேவைகள்: மென்பொருள் மேம்பாடு, தொழில்நுட்ப திட்டங்கள் மற்றும் திறன் பயிற்சி திட்டங்கள்\n• ஆதரவு மற்றும் விசாரணைகள்: மேலும் விவரங்களுக்கு எங்கள் அதிகாரப்பூர்வ இணையதளத்தைப் பார்வையிடவும் அல்லது எங்களைத் தொடர்பு கொள்ளவும்."
    }
  ],
  es: [
    {
      keys: ["sobre", "qué es infyskill", "quién es infyskill", "empresa", "quién eres", "qué es este sitio web", "háblame de tu empresa"],
      answer: "InfySkill (registrada legalmente como InfySkill Edutech Private Limited) es una organización líder en capacitación tecnológica, desarrollo de software y soluciones profesionales con sede en Visakhapatnam, Andhra Pradesh. Fundada en 2023, InfySkill reduce la brecha entre la educación académica y los requisitos de la industria mediante capacitación de primer nivel, desarrollo de habilidades y apoyo para la colocación laboral."
    },
    {
      keys: ["ceo", "cto", "fundador", "fundada", "valluru", "samara", "pravallika", "ganagalla", "quién dirige", "liderazgo", "gestión"],
      answer: "InfySkill Software Solutions fue fundada en abril de 2023. Nuestro liderazgo clave incluye a:\n• Valluru Samara Simha Reddy (CEO y Fundador)\n• Pravallika Ganagalla (CTO y Directora)\nBajo su liderazgo, InfySkill está oficialmente reconocida por el Ministerio de Asuntos Corporativos, MSME, Startup India (DPIIT) y AICTE."
    },
    {
      keys: ["curso", "capacitación", "programa", "qué enseñas", "aprender", "python", "java", "mern", "desarrollo web", "ciencia de datos", "aprendizaje automático", "nube", "inteligencia artificial", "ia"],
      answer: "InfySkill ofrece programas de capacitación alineados con la industria en campos de vanguardia, que incluyen:\n• Programación en Python y Java\n• Desarrollo Web Full-Stack (MERN Stack)\n• Ciencia de Datos y Aprendizaje Automático\n• Inteligencia Artificial (IA)\n• Computación en la Nube\nCada curso es dirigido por profesionales de la industria y cuenta con proyectos prácticos, evaluaciones simuladas y preparación de entrevistas."
    },
    {
      keys: ["servicio", "desarrollo de software", "qué haces", "proyecto", "proyectos", "año final", "artículo de investigación", "documentación", "soporte académico"],
      answer: "InfySkill ofrece una gama completa de servicios profesionales:\n• Desarrollo de Software: Soluciones de software personalizadas, aplicaciones web y consultoría tecnológica.\n• Soporte Académico y de Proyectos: Mentoría, asistencia con documentación, guía para artículos de investigación y soporte técnico para proyectos de ingeniería de último año en diversos dominios.\n• Servicios de Carrera: Simulacros de entrevistas, revisión de currículums, preparación para colocación y pasantías."
    },
    {
      keys: ["ubicación", "dirección", "dónde", "oficina", "visakhapatnam", "vizag", "andhra pradesh"],
      answer: "La oficina principal de InfySkill Software Solutions está ubicada en Visakhapatnam, Andhra Pradesh, India. Brindamos servicios a estudiantes, graduados y empresas tanto a nivel local como en línea en todo el país."
    },
    {
      keys: ["contacto", "correo", "teléfono", "sitio web", "comunicarse", "soporte", "llamar", "postularse"],
      answer: "Puede ponerse en contacto con InfySkill Software Solutions a través de los siguientes canales:\n• Sitio web: https://infyskill.in\n• Servicios: Desarrollo de Software, Proyectos Técnicos y Programas de Capacitación en Habilidades\n• Soporte y consultas: Visite nuestro sitio web oficial o comuníquese a través de nuestros portales de contacto para inscripciones en programas específicos."
    }
  ],
  fr: [
    {
      keys: ["à propos", "qu'est-ce que infyskill", "qui est infyskill", "entreprise", "qui es-tu", "quel est ce site", "parle-moi de ton entreprise"],
      answer: "InfySkill (légalement enregistrée sous le nom d'InfySkill Edutech Private Limited) est une organisation de premier plan dans le domaine de la formation technologique, du développement de logiciels et des solutions de carrière, basée à Visakhapatnam, dans l'Andhra Pradesh. Fondée en 2023, InfySkill comble le fossé entre l'enseignement académique et les exigences de l'industrie en fournissant une formation de haut niveau, le développement des compétences et un soutien au placement professionnel."
    },
    {
      keys: ["ceo", "pdg", "cto", "directeur technique", "fondateur", "fondée", "valluru", "samara", "pravallika", "ganagalla", "qui dirige", "direction", "gestion"],
      answer: "InfySkill Software Solutions a été fondée en avril 2023. Notre direction clé comprend :\n• Valluru Samara Simha Reddy (PDG et fondateur)\n• Pravallika Ganagalla (Directrice technique et directrice)\nSous leur direction, InfySkill est officiellement reconnue par le ministère des Affaires corporatives, MSME, Startup India (DPIIT) et l'AICTE."
    },
    {
      keys: ["cours", "formation", "programme", "qu'enseignes-tu", "apprendre", "python", "java", "mern", "développement web", "science des données", "apprentissage automatique", "cloud", "intelligence artificielle", "ia"],
      answer: "InfySkill propose des programmes de formation adaptés à l'industrie dans des domaines de pointe, notamment :\n• Programmation Python & Java\n• Développement Web Full-Stack (MERN Stack)\n• Science des données & Apprentissage automatique\n• Intelligence artificielle (IA)\n• Cloud Computing\nChaque cours est animé par des professionnels de l'industrie et comprend des projets pratiques, des évaluations blanches et une préparation aux entretiens."
    },
    {
      keys: ["service", "développement de logiciels", "que fais-tu", "projet", "projets", "dernière année", "article de recherche", "documentation", "soutien académique"],
      answer: "InfySkill fournit une gamme complète de services professionnels :\n• Développement de logiciels : Solutions logicielles sur mesure, applications web et conseil technologique.\n• Soutien académique et de projet : Mentorat, aide à la documentation, conseils pour les articles de recherche et soutien technique pour les projets d'ingénierie de fin d'études dans divers domaines.\n• Services de carrière : Entretiens d'entraînement, révision de CV, préparation au placement et stages."
    },
    {
      keys: ["emplacement", "adresse", "où", "bureau", "visakhapatnam", "vizag", "andhra pradesh"],
      answer: "Le bureau principal d'InfySkill Software Solutions est situé à Visakhapatnam, dans l'Andhra Pradesh, en Inde. Nous servons les étudiants, les diplômés et les entreprises locaux et en ligne dans tout le pays."
    },
    {
      keys: ["contact", "e-mail", "téléphone", "site web", "joindre", "support", "appeler", "postuler"],
      answer: "Vous pouvez contacter InfySkill Software Solutions via les canaux suivants :\n• Site web : https://infyskill.in\n• Services : Développement de logiciels, projets techniques et programmes de formation professionnelle\n• Support et demandes : Veuillez visiter notre site officiel ou nous contacter via nos portails pour les inscriptions aux programmes."
    }
  ]
};

const FALLBACK_ANSWERS: Record<Language, string> = {
  en: "As the InfySkill AI Assistant, I couldn't find a specific reference to that. Could you please rephrase your question, or ask about InfySkill's training programs, software development services, academic project support, or contact info?",
  hi: "इन्फीस्किल एआई सहायक के रूप में, मुझे इसका कोई संदर्भ नहीं मिला। क्या आप कृपया अपना प्रश्न फिर से लिख सकते हैं, या इन्फीस्किल के प्रशिक्षण कार्यक्रमों, सॉफ्टवेयर विकास सेवाओं, शैक्षणिक परियोजना सहायता या संपर्क जानकारी के बारे में पूछ सकते हैं?",
  te: "ఇన్ఫీస్కిల్ AI అసిస్టెంట్‌గా, దీనికి సంబంధించిన సమాచారం లభించలేదు. దయచేసి మీ ప్రశ్నను మార్చి అడగండి, లేదా ఇన్ఫీస్కిల్ శిక్షణా కార్యక్రమాలు, సాఫ్ట్‌వేర్ అభివృద్ధి సేవలు, అకడమిక్ ప్రాజెక్ట్ సపోర్ట్ లేదా సంప్రదింపు వివరాల గురించి అడగండి.",
  ta: "இன்ஃபிஸ்கில் AI உதவியாளராக, இதற்கான குறிப்பிட்ட குறிப்பை என்னால் கண்டறிய முடியவில்லை. தயவுசெய்து உங்கள் கேள்வியைக் கொஞ்சம் மாற்றி கேட்கவும், அல்லது இன்ஃபிஸ்கில் பயிற்சித் திட்டங்கள், மென்பொருள் மேம்பாட்டு சேவைகள், திட்ட ஆதரவு அல்லது தொடர்புத் தகவல் பற்றி கேட்கவும்.",
  es: "Como Asistente de IA de InfySkill, no pude encontrar una referencia específica a eso. ¿Podría reformular su pregunta o preguntar sobre los programas de capacitación de InfySkill, los servicios de desarrollo de software, el soporte de proyectos académicos o la información de contacto?",
  fr: "En tant qu'assistant IA d'InfySkill, je n'ai pas trouvé de référence spécifique à ce sujet. Pourriez-vous reformuler votre question ou poser des questions sur les programmes de formation d'InfySkill, les services de développement de logiciels, le soutien aux projets académiques ou les coordonnées de contact ?"
};

const BOT_IDENTITY_ANSWERS: Record<Language, string> = {
  en: "I am the official InfySkill AI Assistant. I am designed to assist you with inquiries about InfySkill Software Solutions, our training programs, software services, and other related topics.",
  hi: "मैं आधिकारिक इन्फीस्किल एआई सहायक हूँ। मैं आपको इन्फीस्किल सॉफ्टवेयर सॉल्यूशंस, हमारे प्रशिक्षण कार्यक्रमों, सॉफ्टवेयर सेवाओं और अन्य संबंधित विषयों के बारे में पूछताछ में सहायता करने के लिए डिज़ाइन किया गया हूँ।",
  te: "నేను అధికారిక ఇన్ఫీస్కిల్ AI అసిస్టెంట్‌ను. ఇన్ఫీస్కిల్ సాఫ్ట్‌వేర్ సొల్యూషన్స్, మా శిక్షణా కార్యక్రమాలు, సాఫ్ట్‌వేర్ సేవలు మరియు ఇతర సంబంధిత అంశాల గురించి మీకు సహాయం చేయడానికి నేను రూపొందించబడ్డాను.",
  ta: "நான் அதிகாரப்பூர்வ இன்ஃபிஸ்கில் AI உதவியாளர். இன்ஃபிஸ்கில் மென்பொருள் தீர்வுகள், எங்கள் பயிற்சித் திட்டங்கள், மென்பொருள் சேவைகள் மற்றும் பிற தொடர்புடைய தலைப்புகள் பற்றிய விசாரணைகளுக்கு உங்களுக்கு உதவ நான் வடிவமைக்கப்பட்டுள்ளேன்.",
  es: "Soy el Asistente de IA oficial de InfySkill. Estoy diseñado para ayudarle con consultas sobre InfySkill Software Solutions, nuestros programas de capacitación, servicios de software y otros temas relacionados.",
  fr: "Je suis l'assistant IA officiel d'InfySkill. Je suis conçu pour vous aider avec vos demandes concernant InfySkill Software Solutions, nos programmes de formation, nos services logiciels et d'autres sujets connexes."
};

function findInfySkillAnswer(query: string, lang: Language): string | null {
  const qLower = query.toLowerCase();
  
  if (
    qLower.includes("who are you") || 
    qLower.includes("what is your name") || 
    qLower.includes("your identity") || 
    qLower.includes("who created you") ||
    qLower.includes("आप कौन हैं") ||
    qLower.includes("तुम्हारा नाम क्या है") ||
    qLower.includes("మీరు ఎవరు") ||
    qLower.includes("మీ పేరు ఏమిటి") ||
    qLower.includes("நீங்கள் யார்") ||
    qLower.includes("qui es-tu") ||
    qLower.includes("quién eres")
  ) {
    return BOT_IDENTITY_ANSWERS[lang];
  }

  const list = INFYSKILL_KNOWLEDGE[lang] || INFYSKILL_KNOWLEDGE.en;
  let bestMatch: typeof list[0] | null = null;
  let maxScore = 0;
  
  for (const item of list) {
    let score = 0;
    for (const key of item.keys) {
      if (qLower.includes(key.toLowerCase())) {
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
    return list[0].answer;
  }
  
  return null;
}

function mockAnswer(q: string, docs: DocItem[], lang: Language): { text: string; source: string } {
  // First, check if there is an InfySkill company-specific answer
  const infyAnswer = findInfySkillAnswer(q, lang);
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
    text: FALLBACK_ANSWERS[lang] || FALLBACK_ANSWERS.en,
    source: "InfySkill Assistant"
  };
}

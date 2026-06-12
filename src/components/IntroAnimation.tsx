import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { ParticleField } from "./ParticleField";
import { Brain } from "lucide-react";

export function IntroAnimation({ onDone }: { onDone: () => void }) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 4200);
    const t2 = setTimeout(onDone, 4900);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [onDone]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.7, ease: "easeInOut" } }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
          style={{ background: "radial-gradient(ellipse at center, oklch(0.22 0.05 270) 0%, oklch(0.1 0.03 265) 70%)" }}
        >
          <ParticleField count={60} />

          {/* Rotating rings */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, opacity: 0, rotate: 0 }}
              animate={{ scale: 1, opacity: 0.6 - i * 0.15, rotate: 360 }}
              transition={{
                scale: { duration: 1.2, delay: i * 0.2, ease: "easeOut" },
                opacity: { duration: 1.2, delay: i * 0.2 },
                rotate: { duration: 8 + i * 4, repeat: Infinity, ease: "linear" },
              }}
              className="absolute rounded-full border"
              style={{
                width: 240 + i * 140,
                height: 240 + i * 140,
                borderColor: "oklch(0.62 0.22 275 / 40%)",
                borderStyle: i === 1 ? "dashed" : "solid",
                boxShadow: `0 0 60px oklch(0.62 0.22 275 / ${0.3 - i * 0.08})`,
              }}
            />
          ))}

          {/* Neural connections */}
          <svg className="absolute inset-0 h-full w-full opacity-30" xmlns="http://www.w3.org/2000/svg">
            {Array.from({ length: 12 }).map((_, i) => {
              const x1 = 50 + Math.cos((i / 12) * Math.PI * 2) * 35;
              const y1 = 50 + Math.sin((i / 12) * Math.PI * 2) * 35;
              return (
                <motion.line
                  key={i}
                  x1="50%" y1="50%"
                  x2={`${x1}%`} y2={`${y1}%`}
                  stroke="url(#g)"
                  strokeWidth="1"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1.5, delay: 0.5 + i * 0.05 }}
                />
              );
            })}
            <defs>
              <linearGradient id="g" x1="0" x2="1">
                <stop offset="0%" stopColor="oklch(0.62 0.22 275)" />
                <stop offset="100%" stopColor="oklch(0.74 0.17 165)" />
              </linearGradient>
            </defs>
          </svg>

          {/* Logo + tagline */}
          <div className="relative z-10 flex flex-col items-center text-center px-6">
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 1, duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="relative mb-6 grid h-24 w-24 place-items-center rounded-3xl"
              style={{ background: "var(--gradient-primary)", boxShadow: "0 0 80px oklch(0.62 0.22 275 / 70%)" }}
            >
              <Brain className="h-12 w-12 text-white" strokeWidth={2.2} />
              {/* Light sweep */}
              <motion.div
                initial={{ x: "-150%" }}
                animate={{ x: "150%" }}
                transition={{ delay: 2.2, duration: 1.2, ease: "easeInOut" }}
                className="absolute inset-0 overflow-hidden rounded-3xl"
              >
                <div className="h-full w-1/2 bg-gradient-to-r from-transparent via-white/60 to-transparent skew-x-12" />
              </motion.div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5, duration: 0.9 }}
              className="text-4xl sm:text-6xl font-extrabold tracking-tight"
            >
              <span className="gradient-text">InfySkill</span>
              <span className="text-foreground/90"> Software Solutions</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.4, duration: 0.9 }}
              className="mt-4 text-base sm:text-lg text-muted-foreground max-w-xl"
            >
              Transforming Documents into Intelligent Conversations
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 3.2 }}
              className="mt-8 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground"
            >
              <span className="h-px w-10 bg-gradient-to-r from-transparent to-primary" />
              Initializing Neural Engine
              <span className="h-px w-10 bg-gradient-to-l from-transparent to-primary" />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

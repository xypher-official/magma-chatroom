import { motion } from "framer-motion";
import { useMemo } from "react";
import { useSiteEffects } from "@/hooks/useSiteEffects";

/**
 * Renders global visual effects (snow, rain, confetti, fireworks) over the entire site.
 * Driven by the site_effects table. Hats are applied via CSS class on avatars (see useSiteEffects + global styles).
 */
const SiteEffectsLayer = () => {
  const { isOn } = useSiteEffects();

  const snow = isOn("snow");
  const rain = isOn("rain");
  const confetti = isOn("confetti");
  const fireworks = isOn("fireworks");
  const hats = isOn("hats");

  const flakes = useMemo(() => Array.from({ length: 60 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 6,
    dur: 6 + Math.random() * 8,
    size: 6 + Math.random() * 10,
    drift: -20 + Math.random() * 40,
  })), []);

  const drops = useMemo(() => Array.from({ length: 80 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 1.2,
    dur: 0.5 + Math.random() * 0.8,
  })), []);

  const pieces = useMemo(() => Array.from({ length: 80 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 4,
    dur: 3 + Math.random() * 5,
    color: ["#f97316","#d946ef","#22c55e","#3b82f6","#facc15","#ef4444"][i % 6],
    rot: Math.random() * 360,
  })), []);

  return (
    <>
      {/* Hats global stylesheet hook */}
      {hats && (
        <style>{`
          .magma-gradient, .bg-gradient-to-br.from-fuchsia-500 { position: relative; }
          .magma-gradient::before, [class*="rounded-full"]:has(> img)::before {
            content: "🎩";
            position: absolute;
            top: -10px; left: 50%;
            transform: translateX(-50%) rotate(-12deg);
            font-size: 14px;
            pointer-events: none;
            filter: drop-shadow(0 1px 2px rgba(0,0,0,.4));
          }
        `}</style>
      )}

      <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
        {snow && flakes.map(f => (
          <motion.div key={`s${f.id}`}
            initial={{ y: -20, x: `${f.x}vw`, opacity: 0 }}
            animate={{ y: "110vh", x: `calc(${f.x}vw + ${f.drift}px)`, opacity: [0, 1, 1, 0.7] }}
            transition={{ duration: f.dur, delay: f.delay, repeat: Infinity, ease: "linear" }}
            style={{ width: f.size, height: f.size }}
            className="absolute rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,.6)]"
          />
        ))}
        {rain && drops.map(d => (
          <motion.div key={`r${d.id}`}
            initial={{ y: -40, x: `${d.x}vw`, opacity: 0.6 }}
            animate={{ y: "110vh", opacity: [0.6, 0.9, 0.4] }}
            transition={{ duration: d.dur, delay: d.delay, repeat: Infinity, ease: "linear" }}
            className="absolute w-[2px] h-6 bg-gradient-to-b from-transparent via-sky-300/70 to-sky-400/90"
          />
        ))}
        {confetti && pieces.map(p => (
          <motion.div key={`c${p.id}`}
            initial={{ y: -20, x: `${p.x}vw`, opacity: 1, rotate: 0 }}
            animate={{ y: "110vh", rotate: 720, opacity: [1, 1, 0.6] }}
            transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: "easeIn" }}
            style={{ background: p.color }}
            className="absolute w-2.5 h-3 rounded-sm"
          />
        ))}
        {fireworks && Array.from({ length: 5 }).map((_, i) => (
          <motion.div key={`fw${i}`}
            className="absolute"
            style={{ left: `${15 + i * 17}%`, top: `${20 + (i % 3) * 20}%` }}
            animate={{ scale: [0, 1.4, 0], opacity: [0, 1, 0] }}
            transition={{ duration: 1.6, delay: i * 0.4, repeat: Infinity, repeatDelay: 2 }}
          >
            <div className="w-32 h-32 rounded-full bg-gradient-radial from-amber-300 via-orange-500 to-transparent blur-md" />
          </motion.div>
        ))}
      </div>
    </>
  );
};

export default SiteEffectsLayer;
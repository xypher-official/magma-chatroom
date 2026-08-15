import { motion } from "framer-motion";

interface Props { label?: string; sub?: string; fullscreen?: boolean }

/** Ultra-professional volcanic loading screen. */
const MagmaLoader = ({ label = "Magma ChatRoom", sub = "Encendiendo el núcleo…", fullscreen = true }: Props) => (
  <div className={`${fullscreen ? "fixed inset-0 z-[9999]" : "w-full py-20"} flex flex-col items-center justify-center bg-background overflow-hidden`}>
    {/* magma glow field */}
    <motion.div
      aria-hidden
      className="absolute w-[70vmax] h-[70vmax] rounded-full blur-3xl opacity-30"
      style={{ background: "radial-gradient(circle at 50% 50%, hsl(20 90% 55% / .9), transparent 65%)" }}
      animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.35, 0.2] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
    />
    <div className="relative flex flex-col items-center gap-6">
      <div className="relative w-24 h-24">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute inset-0 rounded-full border-2 border-primary/40"
            animate={{ scale: [0.7, 1.35], opacity: [0.8, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.6, ease: "easeOut" }}
          />
        ))}
        <motion.div
          className="absolute inset-3 rounded-full magma-gradient magma-glow-sm flex items-center justify-center text-2xl"
          animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.06, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          🌋
        </motion.div>
      </div>
      <div className="text-center px-6">
        <motion.h1
          className="text-lg sm:text-xl font-bold bg-gradient-to-r from-amber-300 via-orange-500 to-red-500 bg-clip-text text-transparent"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        >
          {label}
        </motion.h1>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      </div>
      <div className="w-48 h-1.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-full w-1/3 rounded-full magma-gradient"
          animate={{ x: ["-120%", "320%"] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </div>
  </div>
);

export default MagmaLoader;

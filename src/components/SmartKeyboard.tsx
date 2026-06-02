import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Delete, ArrowBigUp, Space, CornerDownLeft, Sparkles, Smile } from "lucide-react";

/**
 * Smart in-app keyboard. Activated per-user via Settings. Sits below
 * an input field and forwards keys via the `onInsert`/`onBackspace`/`onSubmit`
 * callbacks. Includes simple word predictions and emoji suggestions.
 */

const ROWS_LOWER = [
  ["q","w","e","r","t","y","u","i","o","p"],
  ["a","s","d","f","g","h","j","k","l","ñ"],
  ["z","x","c","v","b","n","m",",",".","?"],
];
const ROWS_UPPER = ROWS_LOWER.map((r) => r.map((k) => k.length === 1 && /[a-zñ]/i.test(k) ? k.toUpperCase() : k));

const SUGGESTIONS_DICT: Record<string, string[]> = {
  "h": ["hola", "hey", "hello"],
  "q": ["qué", "que", "quiero"],
  "g": ["gracias", "genial"],
  "b": ["bien", "buenas"],
  "c": ["cómo", "claro"],
  "t": ["te", "tengo"],
  "s": ["sí", "saludos"],
};
const EMOJI_QUICK = ["🔥", "🌋", "😂", "❤️", "👍", "🙌", "✨", "🎉"];

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  theme?: "magma" | "ice" | "neon" | "minimal";
}

const themeMap = {
  magma: { key: "bg-card hover:bg-muted text-foreground", action: "magma-gradient text-primary-foreground" },
  ice: { key: "bg-sky-950/40 hover:bg-sky-900/50 text-sky-100", action: "bg-gradient-to-br from-cyan-400 to-blue-500 text-white" },
  neon: { key: "bg-zinc-900 hover:bg-zinc-800 text-fuchsia-300", action: "bg-gradient-to-br from-fuchsia-500 to-violet-500 text-white" },
  minimal: { key: "bg-muted hover:bg-muted/70 text-foreground", action: "bg-foreground text-background" },
};

const SmartKeyboard = ({ value, onChange, onSubmit, theme = "magma" }: Props) => {
  const [shift, setShift] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const rows = shift ? ROWS_UPPER : ROWS_LOWER;
  const klass = themeMap[theme] ?? themeMap.magma;

  const lastWord = value.split(/\s/).slice(-1)[0]?.toLowerCase() ?? "";
  const suggestions = useMemo(() => {
    if (!lastWord) return [];
    const seed = SUGGESTIONS_DICT[lastWord[0]] ?? [];
    return seed.filter((w) => w.startsWith(lastWord) && w !== lastWord).slice(0, 3);
  }, [lastWord]);

  const insert = (s: string) => { onChange(value + s); if (shift) setShift(false); };
  const backspace = () => onChange(value.slice(0, -1));
  const acceptSuggestion = (w: string) => {
    const parts = value.split(/(\s+)/);
    parts[parts.length - 1] = w;
    onChange(parts.join("") + " ");
  };

  // close emoji panel when typing
  useEffect(() => { if (showEmoji && lastWord) setShowEmoji(false); }, [lastWord]); // eslint-disable-line

  return (
    <motion.div
      initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className="w-full select-none border-t border-border bg-background/80 backdrop-blur-md p-2"
    >
      {/* Suggestions */}
      <div className="flex gap-1.5 mb-2 overflow-x-auto scrollbar-magma min-h-[34px] items-center">
        {suggestions.length > 0
          ? suggestions.map((s) => (
              <motion.button key={s} whileTap={{ scale: 0.92 }} onClick={() => acceptSuggestion(s)}
                className="px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-semibold whitespace-nowrap">
                {s}
              </motion.button>
            ))
          : (
            <>
              <button onClick={() => setShowEmoji((v) => !v)} className="px-2 py-1.5 rounded-lg bg-muted text-muted-foreground hover:text-primary">
                <Smile size={14} />
              </button>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 px-1 flex items-center gap-1">
                <Sparkles size={10} /> Smart keyboard
              </span>
            </>
          )}
      </div>

      <AnimatePresence>
        {showEmoji && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="flex gap-1 mb-2 overflow-hidden">
            {EMOJI_QUICK.map((e) => (
              <motion.button key={e} whileTap={{ scale: 0.85 }} onClick={() => insert(e)}
                className="text-xl p-1.5 rounded-lg hover:bg-muted">{e}</motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rows */}
      {rows.map((row, i) => (
        <div key={i} className="flex gap-1 mb-1 justify-center">
          {i === 2 && (
            <motion.button whileTap={{ scale: 0.88 }} onClick={() => setShift((v) => !v)}
              className={`px-2.5 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${
                shift ? "magma-gradient text-primary-foreground magma-glow-sm" : klass.key
              }`}>
              <ArrowBigUp size={14} />
            </motion.button>
          )}
          {row.map((k) => (
            <motion.button key={k} whileTap={{ scale: 0.85 }}
              onClick={() => insert(k)}
              className={`flex-1 min-w-[26px] h-9 rounded-lg text-sm font-medium transition-colors ${klass.key}`}>
              {k}
            </motion.button>
          ))}
          {i === 2 && (
            <motion.button whileTap={{ scale: 0.88 }} onClick={backspace}
              className={`px-2.5 rounded-lg flex items-center justify-center ${klass.key}`}>
              <Delete size={14} />
            </motion.button>
          )}
        </div>
      ))}
      <div className="flex gap-1 mt-1">
        <motion.button whileTap={{ scale: 0.92 }} onClick={() => insert("123")}
          className={`px-3 h-10 rounded-lg text-xs font-bold ${klass.key}`}>123</motion.button>
        <motion.button whileTap={{ scale: 0.92 }} onClick={() => insert(" ")}
          className={`flex-1 h-10 rounded-lg flex items-center justify-center ${klass.key}`}>
          <Space size={16} />
        </motion.button>
        <motion.button whileTap={{ scale: 0.92 }} onClick={onSubmit}
          className={`px-4 h-10 rounded-lg flex items-center gap-1.5 text-xs font-bold magma-glow-sm ${klass.action}`}>
          <CornerDownLeft size={14} /> Enviar
        </motion.button>
      </div>
    </motion.div>
  );
};

export default SmartKeyboard;
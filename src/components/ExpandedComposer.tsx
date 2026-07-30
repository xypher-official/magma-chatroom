import { motion, AnimatePresence } from "framer-motion";
import { Minimize2, Send, X } from "lucide-react";
import { useEffect, useRef } from "react";

interface Props {
  open: boolean;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  onSend: () => void;
  placeholder?: string;
  title?: string;
}

/** Full-screen "big inbox" writing surface (ChatGPT-style expand). */
const ExpandedComposer = ({ open, value, onChange, onClose, onSend, placeholder, title }: Props) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (open) setTimeout(() => ref.current?.focus(), 60);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] bg-background/80 backdrop-blur-xl flex items-end md:items-center justify-center p-0 md:p-8"
        >
          <motion.div
            initial={{ y: 40, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 40, scale: 0.98, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="w-full md:max-w-3xl h-full md:h-[70vh] flex flex-col glass-panel-strong border border-border md:rounded-3xl overflow-hidden shadow-2xl"
          >
            <div className="px-4 py-3 flex items-center gap-2 border-b border-border">
              <p className="flex-1 text-sm font-semibold text-foreground truncate">{title ?? "Escribir mensaje"}</p>
              <span className="text-xs text-muted-foreground tabular-nums">{value.length}</span>
              <button onClick={onClose} title="Minimizar"
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                <Minimize2 size={16} />
              </button>
              <button onClick={() => { onChange(""); onClose(); }} title="Cerrar y limpiar"
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors">
                <X size={16} />
              </button>
            </div>
            <textarea
              ref={ref}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSend(); }
                if (e.key === "Escape") onClose();
              }}
              placeholder={placeholder}
              className="flex-1 w-full resize-none bg-transparent px-5 py-4 text-base leading-relaxed text-foreground placeholder:text-muted-foreground outline-none scrollbar-magma"
            />
            <div className="px-4 py-3 border-t border-border flex items-center gap-3">
              <p className="flex-1 text-[11px] text-muted-foreground">⌘/Ctrl + Enter para enviar · Esc para minimizar</p>
              <motion.button whileTap={{ scale: 0.95 }} onClick={onSend} disabled={!value.trim()}
                className="px-4 py-2.5 rounded-xl magma-gradient text-primary-foreground text-sm font-semibold disabled:opacity-40 magma-glow-sm flex items-center gap-2">
                <Send size={16} /> Enviar
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ExpandedComposer;

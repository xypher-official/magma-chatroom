import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Check, Globe } from "lucide-react";
import { useMemo, useState } from "react";
import { LANGS, type Lang } from "@/i18n/translations";

interface Props {
  open: boolean;
  current: Lang;
  onClose: () => void;
  onPick: (l: Lang) => void;
}

const LanguagePickerSheet = ({ open, current, onClose, onPick }: Props) => {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return LANGS.filter((l) => !term || l.label.toLowerCase().includes(term) || l.code.includes(term));
  }, [q]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[120] bg-background/85 backdrop-blur-md flex items-end md:items-center justify-center p-4">
          <motion.div
            initial={{ y: 50, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 50, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm max-h-[80vh] glass-panel-strong rounded-3xl border border-primary/20 magma-glow-sm overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Globe size={18} className="text-primary" />
                <h3 className="font-bold text-foreground">Choose language</h3>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
            </div>
            <div className="px-5 pt-4">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Search language…" autoFocus
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-input border border-border text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-magma p-3 space-y-1">
              {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No matches</p>}
              {filtered.map((l) => {
                const active = l.code === current;
                return (
                  <motion.button key={l.code} layout whileHover={{ scale: 1.01, x: 2 }} whileTap={{ scale: 0.99 }}
                    onClick={() => { onPick(l.code); onClose(); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${
                      active ? "bg-primary/15 border border-primary/30" : "hover:bg-muted"
                    }`}>
                    <span className="text-2xl">{l.flag}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground">{l.label}</p>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{l.code}</p>
                    </div>
                    {active && <Check size={16} className="text-primary" />}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LanguagePickerSheet;

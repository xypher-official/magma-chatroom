import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, X, Square } from "lucide-react";
import type { LocationDuration } from "@/hooks/useLocationShare";

interface Props {
  open: boolean;
  sharing: boolean;
  onClose: () => void;
  onStart: (d: LocationDuration) => void;
  onStop: () => void;
}

const OPTS: { code: LocationDuration; label: string }[] = [
  { code: "15m", label: "15 minutes" },
  { code: "1h", label: "1 hour" },
  { code: "8h", label: "8 hours" },
  { code: "until_stop", label: "Until I stop it" },
];

const LocationShareDialog = ({ open, sharing, onClose, onStart, onStop }: Props) => {
  const [pick, setPick] = useState<LocationDuration>("1h");
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose} className="fixed inset-0 z-[80] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-card glass-panel-strong rounded-2xl border border-primary/20 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MapPin className="text-primary" size={20} />
                <h3 className="font-bold text-foreground">Share live location</h3>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
            </div>
            {sharing ? (
              <div className="text-center py-2">
                <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1.4, repeat: Infinity }}
                  className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-3">
                  <MapPin className="text-green-500" size={28} />
                </motion.div>
                <p className="text-sm text-muted-foreground mb-4">You're sharing your location live.</p>
                <button onClick={onStop} className="w-full py-3 rounded-xl bg-destructive text-destructive-foreground font-semibold flex items-center justify-center gap-2">
                  <Square size={14} fill="currentColor" /> Stop sharing
                </button>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-3">Choose how long to share your live position:</p>
                <div className="space-y-2 mb-4">
                  {OPTS.map((o) => (
                    <button key={o.code} onClick={() => setPick(o.code)}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                        pick === o.code ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border bg-muted/30 text-foreground hover:border-primary/40"
                      }`}>
                      {o.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => onStart(pick)}
                  className="w-full py-3 rounded-xl magma-gradient text-primary-foreground font-bold magma-glow-sm">
                  Start sharing
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LocationShareDialog;
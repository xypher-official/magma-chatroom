import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share, Plus, X } from "lucide-react";

const KEY = "magma-ios-install-tip-dismissed";

const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;

/** Tip for iPhone/iPad users: add Magma Chat Room to the home screen. */
const IosInstallTip = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(KEY)) return;
    if (window.self !== window.top) return; // hidden inside preview iframes
    if (!isIos() || isStandalone()) return;
    const timer = setTimeout(() => setShow(true), 1800);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => { localStorage.setItem(KEY, "1"); setShow(false); };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="fixed bottom-4 left-3 right-3 z-[90] glass-panel-strong border border-primary/30 rounded-2xl p-4 shadow-2xl magma-glow-sm"
        >
          <button onClick={dismiss} className="absolute top-2 right-2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
          <p className="text-sm font-semibold text-foreground mb-1">🌋 Instala Magma en tu iPhone</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Toca <Share size={11} className="inline mx-0.5 text-primary" /> <strong>Compartir</strong> en Safari y luego
            <Plus size={11} className="inline mx-0.5 text-primary" /> <strong>Añadir a pantalla de inicio</strong> para
            abrirlo como una app.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IosInstallTip;

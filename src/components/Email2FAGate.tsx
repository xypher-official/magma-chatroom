import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Blocking overlay shown after login when the user has a verified
 * security email on their profile. Requires a fresh OTP before
 * the rest of the app is rendered. Verification state is per-session.
 */

const KEY = "magma_2fa_ok";

interface Props {
  userId: string;
  email: string;
  onPass: () => void;
  onCancel: () => void;
}

const Email2FAGate = ({ userId, email, onPass, onCancel }: Props) => {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const hint = email.replace(/(^.).+(@.+$)/, "$1***$2");

  // Auto-send code on mount
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("email-verify", { body: { action: "challenge" } });
        if (data?.dev_code) toast.success(`Código (dev): ${data.dev_code}`, { duration: 12000 });
        else if (data?.required) toast.success(`📧 Código enviado a ${hint}`);
      } catch (e) { console.warn(e); }
    })();
  }, []); // eslint-disable-line

  const verify = async () => {
    if (code.trim().length < 4) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("email-verify", {
        body: { action: "verify", code: code.trim() },
      });
      if (error || data?.error) throw new Error(error?.message ?? data.error);
      sessionStorage.setItem(KEY + ":" + userId, "1");
      onPass();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-xl flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 24 }}
          className="w-full max-w-sm glass-panel-strong rounded-3xl p-7 border border-primary/30 text-center">
          <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2, repeat: Infinity }}
            className="w-16 h-16 mx-auto rounded-2xl magma-gradient flex items-center justify-center mb-3 magma-glow">
            <ShieldCheck className="text-white" size={28} />
          </motion.div>
          <h2 className="text-xl font-bold magma-gradient-text">Verifica tu correo</h2>
          <p className="text-xs text-muted-foreground mt-1 mb-5 flex items-center justify-center gap-1.5">
            <Mail size={12} /> Código enviado a <strong className="text-foreground">{hint}</strong>
          </p>
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            maxLength={6} placeholder="000000" autoFocus inputMode="numeric"
            onKeyDown={(e) => e.key === "Enter" && verify()}
            className="w-full px-3 py-4 rounded-xl bg-input border border-border text-foreground text-center text-2xl font-mono tracking-[0.5em] outline-none focus:ring-2 focus:ring-primary/40" />
          <div className="flex gap-2 mt-4">
            <button onClick={onCancel}
              className="flex-1 py-3 rounded-xl bg-muted hover:bg-muted/70 text-foreground font-medium text-sm">Cerrar sesión</button>
            <button onClick={verify} disabled={busy || code.length < 4}
              className="flex-1 py-3 rounded-xl magma-gradient text-primary-foreground font-bold magma-glow-sm text-sm disabled:opacity-60">
              {busy ? "…" : "Verificar"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export const consume2FA = (userId: string) => sessionStorage.removeItem("magma_2fa_ok:" + userId);
export const passed2FA = (userId: string) => sessionStorage.getItem("magma_2fa_ok:" + userId) === "1";

export default Email2FAGate;
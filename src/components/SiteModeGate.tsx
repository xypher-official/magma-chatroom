import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Wrench, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import LavaParticles from "./LavaParticles";

interface Props {
  isAdmin: boolean;
  myUserId?: string;
  children: ReactNode;
}

/** Reads `site.mode` from `ui_settings`:
 *  - "maintenance" → blocks everyone except admins behind a magma maintenance screen.
 *  - "private"     → hides the public site (sections / banner / events) and lets
 *                    the user only chat with their existing contacts. Implemented
 *                    here by setting a document-level CSS flag so other components
 *                    can react via the `[data-site-private="1"]` selector.
 *  Anything else  → normal site.
 */
const SiteModeGate = ({ isAdmin, children }: Props) => {
  const [mode, setMode] = useState<string>("");

  useEffect(() => {
    const load = () => supabase.from("ui_settings").select("value").eq("key", "site.mode").maybeSingle()
      .then(({ data }) => setMode((data?.value ?? "").toLowerCase()));
    load();
    const ch = supabase.channel("site-mode-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "ui_settings" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.sitePrivate = mode === "private" ? "1" : "0";
  }, [mode]);

  if (mode === "maintenance" && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
        <LavaParticles />
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="max-w-md text-center px-6 py-10 rounded-3xl glass-panel-strong border border-primary/30 relative z-10">
          <motion.div animate={{ rotate: [0, 12, -12, 0] }} transition={{ duration: 2, repeat: Infinity }}
            className="mx-auto w-16 h-16 mb-5 rounded-2xl magma-gradient flex items-center justify-center magma-glow">
            <Wrench className="text-white" size={28} />
          </motion.div>
          <h1 className="text-2xl font-bold magma-gradient-text mb-3">This Website Is In Maintenance</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Only owner and collaborators can access to the website.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      {mode === "private" && !isAdmin && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-200 text-xs font-medium px-3 py-1.5 flex items-center gap-2 z-30 relative">
          <Lock size={12} /> Modo privado activo — solo chats con tus contactos
        </div>
      )}
      {children}
    </>
  );
};

export default SiteModeGate;

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Settings as SettingsIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  onClose: () => void;
  myUserId: string;
  displayName: string;
  allowDms: boolean;
  onUpdated: () => void;
}

const SettingsDialog = ({ onClose, myUserId, displayName, allowDms, onUpdated }: Props) => {
  const [name, setName] = useState(displayName);
  const [dms, setDms] = useState(allowDms);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: name.trim() || displayName,
        avatar_initials: (name.trim() || displayName).slice(0, 2).toUpperCase(),
        allow_dms: dms,
      })
      .eq("user_id", myUserId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Ajustes guardados ✨");
      onUpdated();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 20, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-card rounded-2xl border border-border overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <SettingsIcon size={18} className="text-primary" />
              <h2 className="font-bold magma-gradient-text">Ajustes</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
              <X size={18} />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Nombre</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-ring/50"
              />
            </div>
            <label className="flex items-center justify-between p-3 rounded-xl bg-muted/40 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-foreground">Permitir mensajes nuevos</p>
                <p className="text-xs text-muted-foreground">Si lo desactivas, nadie podrá iniciar un chat contigo.</p>
              </div>
              <input type="checkbox" checked={dms} onChange={(e) => setDms(e.target.checked)} className="w-5 h-5 accent-primary" />
            </label>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={save} disabled={saving}
              className="w-full py-3 rounded-xl magma-gradient text-primary-foreground font-semibold magma-glow-sm disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar"}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SettingsDialog;

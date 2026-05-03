import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Palette, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCallTheme, type CallTheme } from "@/hooks/useCallTheme";

const CallStudio = () => {
  const themeFromDb = useCallTheme();
  const [theme, setTheme] = useState<CallTheme>(themeFromDb);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAuthorized(false); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      setAuthorized(!!data);
    })();
  }, []);

  useEffect(() => { setTheme(themeFromDb); setLoading(false); }, [themeFromDb]);

  const update = (patch: Partial<CallTheme>) => setTheme((t) => ({ ...t, ...patch }));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("call_theme").update({ ...theme, updated_at: new Date().toISOString() }).eq("id", 1);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("✨ Call theme saved");
  };

  if (authorized === false) return (
    <div className="min-h-screen flex items-center justify-center text-center p-6">
      <div>
        <p className="text-foreground font-semibold text-lg mb-2">Admin only</p>
        <Link to="/" className="text-primary hover:underline">← Back home</Link>
      </div>
    </div>
  );

  if (loading || !theme) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading studio…</div>;

  return (
    <div className="min-h-screen bg-background ember-bg">
      <header className="px-4 py-3 border-b border-border glass-panel flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground"><ArrowLeft size={18} /></button>
        <Palette className="text-primary" size={20} />
        <h1 className="text-lg font-bold magma-gradient-text">Call Studio</h1>
        <button onClick={save} disabled={saving}
          className="ml-auto px-4 py-2 rounded-xl magma-gradient text-primary-foreground text-sm font-semibold flex items-center gap-2 disabled:opacity-60">
          <Save size={14} /> {saving ? "Saving…" : "Save"}
        </button>
      </header>

      <div className="grid lg:grid-cols-2 gap-6 p-6 max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
          className="space-y-5 glass-panel-strong rounded-2xl p-6 border border-border">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground font-semibold">Colors</h2>
          <Field label="Primary color">
            <input type="color" value={theme.primary_color} onChange={(e) => update({ primary_color: e.target.value })}
              className="w-full h-12 rounded-lg cursor-pointer bg-transparent" />
          </Field>
          <Field label="Accent color">
            <input type="color" value={theme.accent_color} onChange={(e) => update({ accent_color: e.target.value })}
              className="w-full h-12 rounded-lg cursor-pointer bg-transparent" />
          </Field>
          <Field label="Background style">
            <select value={theme.background_style} onChange={(e) => update({ background_style: e.target.value })}
              className="w-full p-3 rounded-xl bg-input border border-border text-foreground">
              <option value="magma">Magma (default)</option>
              <option value="black">Pure black</option>
              <option value="blur">Blurred remote</option>
              <option value="gradient">Custom gradient</option>
            </select>
          </Field>

          <h2 className="text-sm uppercase tracking-wider text-muted-foreground font-semibold pt-3">Layout</h2>
          <Field label="Buttons position">
            <div className="grid grid-cols-3 gap-2">
              {["top","bottom","right"].map((p) => (
                <button key={p} onClick={() => update({ button_position: p })}
                  className={`py-2 rounded-lg border text-sm capitalize ${theme.button_position === p ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:border-primary/40"}`}>
                  {p}
                </button>
              ))}
            </div>
          </Field>
          <div className="flex items-center justify-between">
            <label className="text-sm text-foreground">Show timer (like WhatsApp)</label>
            <input type="checkbox" checked={theme.show_timer} onChange={(e) => update({ show_timer: e.target.checked })}
              className="w-5 h-5 accent-primary cursor-pointer" />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-foreground">Show participants list</label>
            <input type="checkbox" checked={theme.show_participants} onChange={(e) => update({ show_participants: e.target.checked })}
              className="w-5 h-5 accent-primary cursor-pointer" />
          </div>

          <h2 className="text-sm uppercase tracking-wider text-muted-foreground font-semibold pt-3">Labels</h2>
          <Field label="Hangup button label">
            <input value={theme.hangup_label} onChange={(e) => update({ hangup_label: e.target.value })} className="w-full p-3 rounded-xl bg-input border border-border text-foreground" />
          </Field>
          <Field label="Mute button label">
            <input value={theme.mute_label} onChange={(e) => update({ mute_label: e.target.value })} className="w-full p-3 rounded-xl bg-input border border-border text-foreground" />
          </Field>
          <Field label="Camera button label">
            <input value={theme.camera_label} onChange={(e) => update({ camera_label: e.target.value })} className="w-full p-3 rounded-xl bg-input border border-border text-foreground" />
          </Field>
        </motion.div>

        {/* Preview */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          className="rounded-2xl overflow-hidden border border-border h-[500px] relative flex flex-col"
          style={{ background: theme.background_style === "black" ? "#000" : `linear-gradient(135deg, ${theme.primary_color}55, ${theme.accent_color}55)` }}>
          <div className="absolute top-3 left-3 flex items-center gap-2 text-xs text-white/80"><Eye size={12} /> Live preview</div>
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="w-28 h-28 rounded-full p-1 mb-4 magma-glow-intense" style={{ background: `linear-gradient(135deg, ${theme.primary_color}, ${theme.accent_color})` }}>
              <div className="w-full h-full rounded-full bg-card flex items-center justify-center text-4xl font-bold" style={{ color: theme.primary_color }}>JD</div>
            </div>
            <p className="text-2xl font-bold text-white">John Doe</p>
            {theme.show_timer && <p className="text-white/70 mt-1 font-mono">00:42</p>}
          </div>
          <div className={`p-5 flex justify-center gap-3 ${theme.button_position === "top" ? "order-first" : ""}`}>
            <button className="px-5 py-2 rounded-full text-white text-xs font-semibold" style={{ background: theme.primary_color }}>{theme.mute_label}</button>
            <button className="px-5 py-2 rounded-full text-white text-xs font-semibold" style={{ background: theme.accent_color }}>{theme.camera_label}</button>
            <button className="px-5 py-2 rounded-full bg-red-600 text-white text-xs font-semibold">{theme.hangup_label}</button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs text-muted-foreground mb-1.5 font-medium">{label}</label>
    {children}
  </div>
);

export default CallStudio;
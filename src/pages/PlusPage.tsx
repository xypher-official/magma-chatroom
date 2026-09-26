import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Crown, Check, Image as ImageIcon, Loader2, Upload, Bot, Palette, CalendarClock } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import LavaParticles from "@/components/LavaParticles";
import { supabase } from "@/integrations/supabase/client";
import { usePlus, startCheckout, openPortal } from "@/hooks/usePlus";

export const WALLPAPER_PRESETS = [
  "linear-gradient(160deg,#1a0500 0%,#7a1400 55%,#ff6a00 100%)",
  "linear-gradient(160deg,#050816 0%,#1e1b4b 50%,#0ea5e9 100%)",
  "linear-gradient(160deg,#021a0f 0%,#065f46 60%,#34d399 100%)",
  "linear-gradient(160deg,#1a0012 0%,#831843 55%,#f472b6 100%)",
  "radial-gradient(circle at 30% 20%,#ffb347 0%,#b91c1c 45%,#0a0a0a 100%)",
  "linear-gradient(160deg,#0a0a0a 0%,#262626 100%)",
];

const PERKS = [
  { icon: ImageIcon, t: "Fondo de pantalla a tu gusto en todos tus chats" },
  { icon: Bot, t: "MAGAI como agente: cambia tu cuenta por ti" },
  { icon: CalendarClock, t: "Mensajes programados a cualquier persona" },
  { icon: Palette, t: "Colores personalizados para tus burbujas" },
];

const PlusPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { subscribed, end, loading, refresh } = usePlus();
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (params.get("success")) { toast.success("👑 ¡Bienvenido a ChatRoom Plus!"); refresh(); }
    if (params.get("canceled")) toast("Pago cancelado");
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUid(data.user.id);
      const { data: p } = await supabase.from("profiles").select("wallpaper_url").eq("user_id", data.user.id).maybeSingle();
      setCurrent(p?.wallpaper_url ?? null);
    });
  }, []);

  const pay = async () => {
    setBusy(true);
    try { await startCheckout(); } catch (e: any) { toast.error(e.message); setBusy(false); }
  };
  const manage = async () => {
    setBusy(true);
    try { await openPortal(); } catch (e: any) { toast.error(e.message); setBusy(false); }
  };

  const setWallpaper = async (value: string | null) => {
    if (!uid) return;
    const { error } = await supabase.from("profiles").update({ wallpaper_url: value }).eq("user_id", uid);
    if (error) { toast.error(error.message); return; }
    setCurrent(value); toast.success("Fondo actualizado");
  };

  const upload = async (f: File) => {
    if (!uid) return;
    const path = `wallpapers/${uid}/${Date.now()}-${f.name.replace(/[^\w.]/g, "_")}`;
    const { error } = await supabase.storage.from("social-media").upload(path, f, { upsert: true });
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from("social-media").getPublicUrl(path);
    setWallpaper(`url("${data.publicUrl}") center/cover`);
  };

  return (
    <div className="min-h-[100dvh] bg-background relative overflow-x-hidden">
      <LavaParticles />
      <header className="relative z-10 px-4 py-3 flex items-center gap-3 border-b border-border glass-panel pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button onClick={() => navigate("/")} className="p-2 rounded-xl hover:bg-muted text-muted-foreground"><ArrowLeft size={18} /></button>
        <Crown size={18} className="text-primary" />
        <h1 className="font-bold">ChatRoom Plus</h1>
      </header>

      <main className="relative z-10 max-w-xl mx-auto p-4 space-y-5 pb-16">
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-6 magma-gradient text-primary-foreground shadow-2xl">
          <div className="flex items-center gap-2 text-sm opacity-90"><Crown size={16} /> Membresía</div>
          <h2 className="text-3xl font-black mt-1">ChatRoom Plus</h2>
          <p className="mt-1 text-lg font-semibold">US$1.99 <span className="text-sm opacity-80">/ mes</span></p>
          <ul className="mt-4 space-y-2">
            {PERKS.map(({ icon: I, t }) => (
              <li key={t} className="flex items-center gap-2 text-sm"><I size={16} /> {t}</li>
            ))}
          </ul>
          {loading ? (
            <div className="mt-5 flex justify-center"><Loader2 className="animate-spin" /></div>
          ) : subscribed ? (
            <div className="mt-5 space-y-2">
              <div className="flex items-center gap-2 font-semibold"><Check size={18} /> Eres Plus{end ? ` · renueva ${new Date(end).toLocaleDateString()}` : ""}</div>
              <button disabled={busy} onClick={manage} className="w-full py-3 rounded-2xl bg-background/20 font-bold">Gestionar membresía</button>
            </div>
          ) : (
            <motion.button whileTap={{ scale: 0.97 }} disabled={busy} onClick={pay}
              className="mt-5 w-full py-3.5 rounded-2xl bg-background text-foreground font-black flex items-center justify-center gap-2">
              {busy ? <Loader2 className="animate-spin" size={18} /> : <Crown size={18} />} Pagar y hacerme Plus
            </motion.button>
          )}
        </motion.section>

        <section className={`glass-panel rounded-3xl p-5 border border-border ${subscribed ? "" : "opacity-60 pointer-events-none"}`}>
          <h3 className="font-bold mb-1">Fondo de pantalla</h3>
          <p className="text-xs text-muted-foreground mb-3">{subscribed ? "Elige uno o sube tu propia foto." : "Disponible con ChatRoom Plus."}</p>
          <div className="grid grid-cols-3 gap-2">
            {WALLPAPER_PRESETS.map((w) => (
              <button key={w} onClick={() => setWallpaper(w)} style={{ background: w }}
                className={`aspect-[3/4] rounded-2xl border-2 ${current === w ? "border-primary" : "border-transparent"}`} />
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => fileRef.current?.click()} className="flex-1 py-2.5 rounded-xl bg-muted text-sm font-semibold flex items-center justify-center gap-2"><Upload size={15} /> Subir foto</button>
            <button onClick={() => setWallpaper(null)} className="px-4 py-2.5 rounded-xl bg-muted text-sm">Quitar</button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </section>
      </main>
    </div>
  );
};

export default PlusPage;

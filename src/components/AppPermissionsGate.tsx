import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, MapPin, Megaphone, Check, X, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const DONE_KEY = "magma-permissions-onboarded";
export const OWNER_ALERTS_KEY = "magma-owner-alerts";

const isInstalled = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as any).standalone === true ||
  /wv|Median|Capacitor|MagmaApp/i.test(navigator.userAgent || "");

type State = "idle" | "ok" | "no";

const Row = ({
  Icon, title, desc, state, onAsk, cta,
}: { Icon: any; title: string; desc: string; state: State; onAsk: () => void; cta: string }) => (
  <div className="flex items-start gap-3 rounded-xl border border-border bg-card/60 p-4">
    <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-primary/15 text-primary">
      <Icon size={17} />
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>
      {state === "idle" ? (
        <button
          onClick={onAsk}
          className="mt-2.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {cta}
        </button>
      ) : (
        <p className={`mt-2 flex items-center gap-1.5 text-xs font-semibold ${state === "ok" ? "text-primary" : "text-muted-foreground"}`}>
          {state === "ok" ? <Check size={13} /> : <X size={13} />}
          {state === "ok" ? "Activado" : "No activado"}
        </p>
      )}
    </div>
  </div>
);

/** First-launch permission flow for the installed app: notifications, location, owner alerts. */
const AppPermissionsGate = () => {
  const [open, setOpen] = useState(false);
  const [notif, setNotif] = useState<State>("idle");
  const [loc, setLoc] = useState<State>("idle");
  const [owner, setOwner] = useState<State>("idle");

  useEffect(() => {
    if (localStorage.getItem(DONE_KEY)) return;
    if (window.self !== window.top) return; // never inside preview iframes
    if (!isInstalled()) return;
    if (typeof Notification !== "undefined" && Notification.permission === "granted") setNotif("ok");
    const t = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(t);
  }, []);

  const askNotif = async () => {
    if (typeof Notification === "undefined") { setNotif("no"); toast.error("Este dispositivo no soporta notificaciones"); return; }
    try {
      const r = await Notification.requestPermission();
      setNotif(r === "granted" ? "ok" : "no");
      if (r === "granted") toast.success("Notificaciones activadas");
    } catch { setNotif("no"); }
  };

  const askLoc = () => {
    if (!navigator.geolocation) { setLoc("no"); return; }
    navigator.geolocation.getCurrentPosition(
      () => { setLoc("ok"); toast.success("Ubicación permitida"); },
      () => { setLoc("no"); toast("Ubicación no permitida"); },
      { timeout: 10000 }
    );
  };

  const askOwner = () => {
    localStorage.setItem(OWNER_ALERTS_KEY, "1");
    setOwner("ok");
    toast.success("Recibirás las alertas del owner");
  };

  const finish = () => {
    if (owner === "idle") localStorage.setItem(OWNER_ALERTS_KEY, "0");
    localStorage.setItem(DONE_KEY, "1");
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-end justify-center bg-background/80 backdrop-blur-md p-3 sm:items-center"
        >
          <motion.div
            initial={{ y: 60, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="glass-panel-strong w-full max-w-md space-y-3 rounded-3xl border border-primary/30 p-5 shadow-2xl magma-glow-sm"
          >
            <div className="flex items-center gap-3">
              <img src="/icon-192.png" alt="Magma" className="h-12 w-12 rounded-2xl" />
              <div>
                <p className="text-base font-bold magma-gradient-text">Bienvenido a Magma</p>
                <p className="text-xs text-muted-foreground">Activa los permisos para la mejor experiencia</p>
              </div>
            </div>

            <Row Icon={Bell} title="Notificaciones" cta="Permitir notificaciones" state={notif} onAsk={askNotif}
              desc="Avisos de mensajes nuevos, llamadas entrantes e invitaciones." />
            <Row Icon={MapPin} title="Ubicación" cta="Permitir ubicación" state={loc} onAsk={askLoc}
              desc="Necesaria para compartir tu ubicación en tiempo real en los chats." />
            <Row Icon={Megaphone} title="Alertas del owner" cta="Recibir alertas" state={owner} onAsk={askOwner}
              desc="Anuncios importantes, mantenimiento y novedades del equipo de Magma." />

            <button
              onClick={finish}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-muted/30 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted/60"
            >
              <ShieldCheck size={15} className="text-primary" /> Continuar
            </button>
            <p className="text-center text-[11px] text-muted-foreground">
              Puedes cambiar esto luego en Ajustes → Avisos.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AppPermissionsGate;

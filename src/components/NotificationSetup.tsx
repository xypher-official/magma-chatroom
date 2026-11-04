import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Bell, BellRing, BellOff, Download, Share2, PlusSquare,
  Smartphone, MonitorSmartphone, CheckCircle2, Clock, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { enablePush } from "@/lib/push";

const ANDROID_APP_URL =
  "https://apps-market.lovable.app/app/5d4623c7-cf66-45ea-a64c-e034070c6554";
const HOME_SCREEN_KEY = "magma-notif-added-home-screen";

type Platform = "android" | "ios" | "other";

const detectPlatform = (): Platform => {
  const ua = navigator.userAgent || "";
  if (/Android/i.test(ua)) return "android";
  if (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1)
  ) return "ios";
  return "other";
};

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as any).standalone === true;

/** Is this an installed/native shell (Android APK wrapper or installed PWA)? */
const isNativeShell = () =>
  isStandalone() || /wv|Median|Capacitor|MagmaApp/i.test(navigator.userAgent || "");

const Step = ({ n, Icon, text }: { n: number; Icon: any; text: string }) => (
  <li className="flex items-start gap-3">
    <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-lg bg-primary/15 text-[11px] font-bold text-primary">
      {n}
    </span>
    <span className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
      <Icon size={15} className="mt-0.5 flex-none text-primary" />
      <span>{text}</span>
    </span>
  </li>
);

/** Device-aware notification setup flow. Never enables notifications automatically. */
const NotificationSetup = () => {
  const [platform, setPlatform] = useState<Platform>("other");
  const [shell, setShell] = useState(false);
  const [addedHome, setAddedHome] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [busy, setBusy] = useState(false);
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setShell(isNativeShell());
    setAddedHome(localStorage.getItem(HOME_SCREEN_KEY) === "1");
    setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  const requestPermission = async () => {
    if (typeof Notification === "undefined") {
      toast.error("Este dispositivo no soporta notificaciones");
      return;
    }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const status = user ? await enablePush(user.id, true).catch(() => "unsupported" as const) : "unsupported";
      if (status === "open-in-new-tab") toast("Abre la app directamente (no dentro del editor) para activarlas");
      const result = typeof Notification !== "undefined" ? Notification.permission : "denied";
      setPermission(result);
      if (result === "granted") {
        toast.success("Notificaciones activadas");
        try { new Notification("Magma Chat Room", { body: "Las notificaciones están activas." }); } catch { /* ignore */ }
      } else {
        toast("Notificaciones no activadas");
      }
    } catch {
      toast.error("No se pudo solicitar el permiso");
    } finally {
      setBusy(false);
    }
  };

  const granted = permission === "granted";
  const blocked = permission === "denied";

  const EnableButton = ({ label }: { label: string }) => (
    <div className="space-y-2">
      <button
        onClick={requestPermission}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <BellRing size={16} /> {label}
      </button>
      <button
        onClick={() => { setDeclined(true); toast("Puedes activarlas más tarde"); }}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-muted/30 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60"
      >
        <Clock size={15} /> Ahora no
      </button>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Status */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-4">
        {granted ? <CheckCircle2 size={18} className="flex-none text-primary" />
          : blocked ? <BellOff size={18} className="flex-none text-destructive" />
          : <Bell size={18} className="flex-none text-primary" />}
        <div>
          <p className="text-sm font-semibold text-foreground">
            {granted ? "Notificaciones activadas"
              : blocked ? "Notificaciones bloqueadas"
              : "Notificaciones desactivadas"}
          </p>
          <p className="text-xs text-muted-foreground">
            {granted ? "Recibirás avisos de mensajes y llamadas."
              : blocked ? "Actívalas desde los ajustes del sistema para este sitio o app."
              : "Actívalas manualmente cuando quieras."}
          </p>
        </div>
      </div>

      {/* Android */}
      {platform === "android" && !granted && (
        <div className="space-y-3 rounded-xl border border-border bg-card/60 p-4">
          <div className="flex items-center gap-2">
            <Smartphone size={16} className="text-primary" />
            <p className="text-sm font-semibold text-foreground">Android</p>
          </div>
          {shell ? (
            <>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Estás en la app de Android. Toca el botón para permitir las notificaciones del sistema.
              </p>
              {!declined && <EnableButton label="Permitir notificaciones" />}
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Para recibir notificaciones en Android necesitas descargar la app oficial de
                Magma Chat Room. Después de instalarla y abrirla, te pediremos el permiso de
                notificaciones y podrás elegir permitirlas o no.
              </p>
              <a
                href={ANDROID_APP_URL} target="_blank" rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Download size={16} /> Descargar Magma Chatroom para Android
                <ArrowRight size={14} />
              </a>
            </>
          )}
        </div>
      )}

      {/* iOS / iPadOS */}
      {platform === "ios" && !granted && (
        <div className="space-y-3 rounded-xl border border-border bg-card/60 p-4">
          <div className="flex items-center gap-2">
            <MonitorSmartphone size={16} className="text-primary" />
            <p className="text-sm font-semibold text-foreground">iPhone / iPad</p>
          </div>
          <ol className="space-y-2.5">
            <Step n={1} Icon={Share2} text="Toca el botón Compartir en Safari." />
            <Step n={2} Icon={PlusSquare} text="Selecciona Añadir a pantalla de inicio." />
            <Step n={3} Icon={Smartphone} text="Abre Magma Chatroom desde el nuevo icono de la pantalla de inicio." />
            <Step n={4} Icon={Bell} text="Vuelve a los ajustes de notificaciones y toca Activar notificaciones." />
            <Step n={5} Icon={CheckCircle2} text="Acepta el permiso de notificaciones del iPhone." />
          </ol>

          {shell ? (
            !declined && <EnableButton label="Activar notificaciones" />
          ) : addedHome ? (
            <p className="rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
              Abre Magma Chatroom desde el icono de la pantalla de inicio y vuelve aquí para
              activar las notificaciones.
            </p>
          ) : (
            <button
              onClick={() => { localStorage.setItem(HOME_SCREEN_KEY, "1"); setAddedHome(true); }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <CheckCircle2 size={16} /> Ya lo añadí a mi pantalla de inicio
            </button>
          )}
        </div>
      )}

      {/* Desktop / other */}
      {platform === "other" && !granted && !declined && (
        <div className="space-y-3 rounded-xl border border-border bg-card/60 p-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Activa las notificaciones del navegador para recibir avisos de mensajes y llamadas.
          </p>
          <EnableButton label="Activar notificaciones" />
        </div>
      )}
    </motion.div>
  );
};

export default NotificationSetup;
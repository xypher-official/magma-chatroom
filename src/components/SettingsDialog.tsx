import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Settings as SettingsIcon, Upload, Sparkles, User, Globe, Bell, LogOut, Image as ImageIcon, Keyboard, Mail, ShieldCheck, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useI18n } from "@/hooks/useI18n";
import { LANGS, type Lang } from "@/i18n/translations";
import { useKeyboardPref, type KbTheme } from "@/hooks/useKeyboardPref";
import NotificationSetup from "@/components/NotificationSetup";

interface Props {
  onClose: () => void;
  myUserId: string;
  displayName: string;
  allowDms: boolean;
  avatarUrl?: string | null;
  avatarInitials?: string;
  onUpdated: () => void;
  onLogout?: () => void;
}

const SettingsDialog = ({ onClose, myUserId, displayName, allowDms, avatarUrl, avatarInitials, onUpdated, onLogout }: Props) => {
  const { t, lang, setLang } = useI18n();
  const [name, setName] = useState(displayName);
  const [dms, setDms] = useState(allowDms);
  const [avatar, setAvatar] = useState<string | null>(avatarUrl ?? null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"profile" | "language" | "keyboard" | "security" | "notifications" | "account">("profile");
  const kb = useKeyboardPref(myUserId);
  const [emailInput, setEmailInput] = useState("");
  const [emailVerified, setEmailVerified] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [verifBusy, setVerifBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data: rows } = await (supabase.rpc as any)("get_my_email");
      const data = Array.isArray(rows) ? rows[0] : rows;
      if (data) {
        setEmailInput((data as any).email ?? "");
        setEmailVerified((data as any).email_verified_at ?? null);
      }
    })();
  }, [myUserId]);

  const sendCode = async () => {
    if (!emailInput.trim()) return;
    setVerifBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("email-verify", {
        body: { action: "send", email: emailInput.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setCodeSent(true);
      if (data?.dev_code) {
        toast.success(`Código (dev): ${data.dev_code}`, { duration: 10000 });
      } else {
        toast.success("📧 Código enviado a tu correo");
      }
    } catch (e: any) { toast.error(e.message); }
    finally { setVerifBusy(false); }
  };

  const confirmCode = async () => {
    if (!codeInput.trim()) return;
    setVerifBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("email-verify", {
        body: { action: "verify", code: codeInput.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setEmailVerified(new Date().toISOString());
      setCodeSent(false); setCodeInput("");
      toast.success("✅ Correo verificado");
    } catch (e: any) { toast.error(e.message); }
    finally { setVerifBusy(false); }
  };

  const removeEmail = async () => {
    if (!confirm("¿Quitar verificación de correo? Tendrás solo contraseña al iniciar sesión.")) return;
    await supabase.from("profiles").update({ email: null, email_verified_at: null }).eq("user_id", myUserId);
    setEmailInput(""); setEmailVerified(null); setCodeSent(false);
    toast.success("Correo removido");
  };

  const uploadAvatar = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${myUserId}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatar(pub.publicUrl);
      await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("user_id", myUserId);
      toast.success("📸 " + t("settings.saved"));
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  };

  const generateAvatar = async () => {
    if (!aiPrompt.trim()) return;
    setGenLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: { prompt: aiPrompt.trim(), purpose: "avatar" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAvatar(data.url);
      toast.success("✨ " + t("settings.saved"));
    } catch (e: any) { toast.error(e.message); }
    finally { setGenLoading(false); }
  };

  const save = async () => {
    setSaving(true);
    const newName = name.trim() || displayName;
    const { error } = await supabase.from("profiles").update({
      display_name: newName,
      avatar_initials: newName.slice(0, 2).toUpperCase(),
      allow_dms: dms,
      language: lang,
    }).eq("user_id", myUserId);
    setSaving(false);
    if (error) { toast.error(error.message); }
    else { toast.success(t("settings.saved")); onUpdated(); onClose(); }
  };

  const tabs: { key: "profile" | "language" | "account"; label: string; Icon: typeof User }[] = [
    { key: "profile", label: t("settings.profile"), Icon: User },
    { key: "language", label: t("settings.language"), Icon: Globe },
    { key: "keyboard" as any, label: "Teclado", Icon: Keyboard as any },
    { key: "security" as any, label: "Mail", Icon: ShieldCheck as any },
    { key: "notifications" as any, label: "Avisos", Icon: Bell as any },
    { key: "account", label: t("settings.account"), Icon: Bell },
  ] as any;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/85 backdrop-blur-md flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.92, y: 20, opacity: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 26 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-card rounded-3xl border border-border overflow-hidden shadow-2xl"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 via-transparent to-primary/5">
            <div className="flex items-center gap-2">
              <SettingsIcon size={18} className="text-primary" />
              <h2 className="font-bold magma-gradient-text text-lg">{t("settings.title")}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="flex border-b border-border bg-muted/20">
            {tabs.map(({ key, label, Icon }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-all ${
                  tab === key ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"
                }`}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          <div className="p-6 max-h-[60vh] overflow-y-auto scrollbar-magma">
            <AnimatePresence mode="wait">
              {tab === "profile" && (
                <motion.div key="profile" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-5">
                  {/* Avatar */}
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-2xl magma-gradient p-0.5 magma-glow-sm overflow-hidden shrink-0">
                      <div className="w-full h-full rounded-2xl bg-card flex items-center justify-center text-2xl font-bold magma-gradient-text overflow-hidden">
                        {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : (avatarInitials ?? "??")}
                      </div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("settings.avatar")}</p>
                      <div className="flex gap-2">
                        <button onClick={() => fileRef.current?.click()} disabled={uploading}
                          className="flex-1 px-3 py-2 rounded-xl bg-muted hover:bg-muted/70 text-foreground text-xs font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50">
                          <Upload size={13} /> {uploading ? "…" : t("settings.uploadAvatar")}
                        </button>
                      </div>
                      <input ref={fileRef} type="file" accept="image/*" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }} />
                    </div>
                  </div>

                  {/* AI generate */}
                  <div className="rounded-2xl bg-gradient-to-br from-fuchsia-500/10 to-amber-500/10 border border-fuchsia-500/20 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Sparkles size={14} className="text-amber-400" /> {t("settings.generateAvatar")}
                    </div>
                    <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder={t("settings.aiPrompt")}
                      className="w-full px-3 py-2.5 rounded-xl bg-background/60 border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                    <button onClick={generateAvatar} disabled={genLoading || !aiPrompt.trim()}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-500 to-amber-500 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                      <ImageIcon size={14} />
                      {genLoading ? t("settings.generating") : t("settings.generateAvatar")}
                    </button>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider">{t("settings.name")}</label>
                    <input value={name} onChange={(e) => setName(e.target.value)}
                      className="mt-1.5 w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                </motion.div>
              )}

              {tab === "language" && (
                <motion.div key="lang" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">{t("settings.language")}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {LANGS.map((l) => (
                      <button key={l.code} onClick={() => setLang(l.code as Lang)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                          lang === l.code
                            ? "border-primary bg-primary/10 magma-glow-sm"
                            : "border-border bg-muted/30 hover:bg-muted/60"
                        }`}>
                        <span className="text-2xl">{l.flag}</span>
                        <span className="text-sm font-medium text-foreground">{l.label}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {tab === "notifications" && (
                <motion.div key="notif" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                  <NotificationSetup />
                </motion.div>
              )}
              {tab === "account" && (
                <motion.div key="account" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-3">
                  <label className="flex items-center justify-between p-4 rounded-xl bg-muted/40 cursor-pointer">
                    <div className="pr-4">
                      <p className="text-sm font-medium text-foreground">{t("settings.allowDms")}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t("settings.allowDmsHint")}</p>
                    </div>
                    <input type="checkbox" checked={dms} onChange={(e) => setDms(e.target.checked)} className="w-5 h-5 accent-primary" />
                  </label>
                  {onLogout && (
                    <button onClick={() => { onLogout(); onClose(); }}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive font-medium text-sm transition-colors">
                      <LogOut size={15} /> {t("settings.logout")}
                    </button>
                  )}
                </motion.div>
              )}

              {tab === "keyboard" && (
                <motion.div key="kb" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
                  <label className="flex items-center justify-between p-4 rounded-xl bg-muted/40 cursor-pointer">
                    <div className="pr-4">
                      <p className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Keyboard size={14} className="text-primary" /> Teclado inteligente
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Activa un teclado animado con predicciones y emojis dentro del chat.
                      </p>
                    </div>
                    <input type="checkbox" checked={kb.enabled}
                      onChange={(e) => kb.update({ enabled: e.target.checked })}
                      className="w-5 h-5 accent-primary" />
                  </label>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Tema del teclado</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(["magma","ice","neon","minimal"] as KbTheme[]).map((th) => (
                        <button key={th} disabled={!kb.enabled}
                          onClick={() => kb.update({ theme: th })}
                          className={`px-3 py-3 rounded-xl border text-sm font-semibold capitalize transition-all ${
                            kb.theme === th ? "border-primary bg-primary/10 magma-glow-sm" : "border-border bg-muted/30 hover:bg-muted/60"
                          } disabled:opacity-40`}>
                          {th}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {tab === "security" && (
                <motion.div key="sec" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
                  <div className="rounded-2xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Mail size={14} className="text-emerald-400" /> Correo de seguridad (opcional)
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Si añades y verificas un correo, tendrás que confirmarlo cada vez que inicies sesión.
                      Sin correo, solo se usará tu contraseña.
                    </p>
                    <div className="flex gap-2">
                      <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="tu@correo.com"
                        disabled={!!emailVerified}
                        className="flex-1 px-3 py-2.5 rounded-xl bg-background/60 border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60" />
                      {emailVerified ? (
                        <span className="px-3 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                          <CheckCircle2 size={14} /> Verificado
                        </span>
                      ) : (
                        <button onClick={sendCode} disabled={verifBusy || !emailInput.trim()}
                          className="px-3 py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-bold disabled:opacity-50">
                          {verifBusy ? "…" : codeSent ? "Reenviar" : "Enviar código"}
                        </button>
                      )}
                    </div>
                    {codeSent && !emailVerified && (
                      <div className="flex gap-2">
                        <input value={codeInput} onChange={(e) => setCodeInput(e.target.value)}
                          placeholder="Código de 6 dígitos" maxLength={6}
                          className="flex-1 px-3 py-2.5 rounded-xl bg-background/60 border border-border text-foreground text-sm outline-none tracking-widest text-center font-mono" />
                        <button onClick={confirmCode} disabled={verifBusy || codeInput.length < 4}
                          className="px-4 py-2.5 rounded-xl magma-gradient text-primary-foreground text-xs font-bold disabled:opacity-50">
                          Confirmar
                        </button>
                      </div>
                    )}
                    {emailVerified && (
                      <button onClick={removeEmail}
                        className="w-full py-2 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-medium">
                        Quitar correo
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="p-5 pt-0">
            <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
              onClick={save} disabled={saving}
              className="w-full py-3 rounded-xl magma-gradient text-primary-foreground font-semibold magma-glow-sm disabled:opacity-60">
              {saving ? t("settings.saving") : t("settings.save")}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SettingsDialog;

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Flame, Lock, User as UserIcon, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import magmaLogo from "@/assets/magma-logo.png";
import { useI18n } from "@/hooks/useI18n";
import { LANGS } from "@/i18n/translations";

const usernameToEmail = (u: string) =>
  `${u.toLowerCase().replace(/[^a-z0-9_]/g, "")}@magmachat.local`;

const AuthPage = () => {
  const { t, lang, setLang } = useI18n();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const u = username.trim();
    if (!u) return;
    if (tab === "register") {
      if (!acceptTerms) { toast.error(t("auth.termsRequired")); return; }
      if (password !== confirmPassword) { toast.error(t("auth.passwordMismatch")); return; }
    }
    if (password.length < 6) { toast.error(t("auth.passwordShort")); return; }
    setLoading(true);
    try {
      const email = usernameToEmail(u);
      if (tab === "register") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/`, data: { username: u, display_name: u } },
        });
        if (error) throw error;
        // Save terms acceptance
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await supabase.from("profiles").update({
              terms_accepted_at: new Date().toISOString(), language: lang,
            }).eq("user_id", session.user.id);
          }
        } catch {}
        toast.success(`${t("auth.created")} 🌋`);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success(`${t("auth.welcome")} 🔥`);
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.functions.invoke("admin-actions", { body: { action: "bootstrap_support_for_me" } });
          if (u === "XypherDev") {
            await supabase.functions.invoke("admin-actions", { body: { action: "claim_admin" } });
          }
        }
      } catch (err) { console.warn("bootstrap failed", err); }
    } catch (err: any) {
      toast.error(err.message ?? "Auth error");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative z-10 px-4 py-8">
      {/* Floating language picker */}
      <div className="absolute top-4 right-4 z-20">
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as any)}
          className="bg-card/70 backdrop-blur-md border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none cursor-pointer hover:bg-card transition-colors"
        >
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
          ))}
        </select>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md"
      >
        {/* Logo + headline */}
        <motion.div className="flex flex-col items-center mb-8"
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
        >
          <motion.div
            className="w-28 h-28 rounded-3xl magma-gradient p-1 magma-glow mb-5 overflow-hidden relative"
            animate={{
              boxShadow: [
                "0 0 40px hsl(24 100% 50% / 0.35), 0 0 80px hsl(24 100% 50% / 0.15)",
                "0 0 70px hsl(24 100% 50% / 0.55), 0 0 140px hsl(24 100% 50% / 0.25)",
                "0 0 40px hsl(24 100% 50% / 0.35), 0 0 80px hsl(24 100% 50% / 0.15)",
              ],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="w-full h-full rounded-3xl bg-card flex items-center justify-center overflow-hidden">
              <img src={magmaLogo} alt="Magma Chat Room" width={92} height={92} className="object-contain" />
            </div>
            <motion.div
              className="absolute -inset-2 rounded-3xl"
              animate={{ rotate: 360 }}
              transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
              style={{ background: "conic-gradient(from 0deg, transparent 0%, hsl(24 100% 50% / 0.15) 50%, transparent 100%)", filter: "blur(8px)", zIndex: -1 }}
            />
          </motion.div>
          <h1 className="text-4xl font-bold magma-gradient-text tracking-tight">Magma Chat Room</h1>
          <p className="text-muted-foreground mt-2 text-sm">{t("app.tagline")}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="glass-panel-strong rounded-3xl p-7 border border-primary/10"
        >
          {/* Tab toggle */}
          <div className="flex rounded-2xl bg-muted/60 p-1 mb-6 relative">
            {(["login", "register"] as const).map((t2) => (
              <button
                key={t2}
                type="button"
                onClick={() => setTab(t2)}
                className={`relative flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 z-10 ${
                  tab === t2 ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === t2 && (
                  <motion.div layoutId="auth-tab-pill"
                    className="absolute inset-0 magma-gradient rounded-xl magma-glow-sm"
                    transition={{ type: "spring", stiffness: 320, damping: 28 }}
                  />
                )}
                <span className="relative">
                  {t2 === "login" ? t("auth.login") : t("auth.register")}
                </span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.form
              key={tab}
              initial={{ opacity: 0, x: tab === "login" ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: tab === "login" ? 20 : -20 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleSubmit}
              className="space-y-3.5"
            >
              <div className="relative">
                <UserIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text" placeholder={t("auth.username")}
                  value={username} onChange={(e) => setUsername(e.target.value)}
                  required autoComplete="username"
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
                />
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPwd ? "text" : "password"} placeholder={t("auth.password")}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  required autoComplete={tab === "login" ? "current-password" : "new-password"}
                  className="w-full pl-11 pr-11 py-3.5 rounded-2xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
                />
                <button type="button" onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {tab === "register" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                  <div className="relative">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type={showPwd ? "text" : "password"} placeholder={t("auth.confirmPassword")}
                      value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required
                      className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
                    />
                  </div>
                </motion.div>
              )}

              {tab === "register" && (
                <motion.label
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex items-start gap-2.5 px-1 pt-1 cursor-pointer select-none"
                >
                  <input type="checkbox" checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-primary cursor-pointer" />
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    {t("auth.termsLabel")}{" "}
                    <Link to="/terms" target="_blank" className="text-primary hover:underline font-medium">
                      {t("auth.termsLink")}
                    </Link>
                  </span>
                </motion.label>
              )}

              <motion.button
                type="submit" disabled={loading}
                whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.98 }}
                className="w-full py-3.5 mt-2 rounded-2xl magma-gradient text-primary-foreground font-bold text-base magma-glow transition-all hover:magma-glow-intense disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading
                  ? <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                      <Flame size={18} />
                    </motion.span>
                  : <>{tab === "login" ? t("auth.enter") : t("auth.create")}</>}
              </motion.button>
            </motion.form>
          </AnimatePresence>

          <p className="text-center text-sm text-muted-foreground mt-5">
            {tab === "login" ? t("auth.noAccount") : t("auth.hasAccount")}{" "}
            <button onClick={() => setTab(tab === "login" ? "register" : "login")}
              className="text-primary hover:underline font-semibold ml-1">
              {tab === "login" ? t("auth.signupHere") : t("auth.loginHere")}
            </button>
          </p>
        </motion.div>

        <p className="text-center text-[11px] text-muted-foreground mt-5">
          <Link to="/terms" className="hover:text-primary transition-colors">{t("auth.termsLink")}</Link>
        </p>
      </motion.div>
    </div>
  );
};

export default AuthPage;

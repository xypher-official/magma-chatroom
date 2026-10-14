import { useState } from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { Link } from "react-router-dom";
import { Flame, Lock, User as UserIcon, Eye, EyeOff, ArrowRight, Check, WandSparkles, Globe, AlertCircle, X, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import magmaLogo from "@/assets/magma-logo.png";
import { useI18n } from "@/hooks/useI18n";
import { LANGS } from "@/i18n/translations";
import LanguagePickerSheet from "./LanguagePickerSheet";
import { Button } from "@/components/ui/button";
import { AUTH_COPY } from "@/i18n/authCopy";

const MotionButton = motion(Button);

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
  const [langOpen, setLangOpen] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const copy = AUTH_COPY[lang];
  const checks = [password.length >= 6, /[a-z]/.test(password) && /[A-Z]/.test(password), /[0-9\W]/.test(password), password.length >= 12];
  const score = password.length >= 6 ? checks.filter(Boolean).length : 0;
  const strengthLabels = [copy.weak, copy.weak, copy.fair, copy.strong, copy.excellent];
  const generatePassword = () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
    const values = crypto.getRandomValues(new Uint32Array(16));
    const generated = "Aa7!" + Array.from(values, value => alphabet[value % alphabet.length]).join("");
    setPassword(generated);
    setConfirmPassword(generated);
    setShowPwd(false);
    toast.success(copy.generated);
  };
  const fieldClass = "w-full min-w-0 h-12 pl-11 pr-12 rounded-lg bg-input/60 border border-border text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60 hover:border-foreground/20 disabled:opacity-60 transition-all";
  const currentLang = LANGS.find((l) => l.code === lang) ?? LANGS[0];

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
    <MotionConfig reducedMotion="user">
    <div className="relative z-10 min-h-dvh w-full px-5 py-4 sm:px-8 sm:py-6 flex flex-col">
      <header className="flex w-full max-w-6xl mx-auto items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Flame className="h-5 w-5 text-primary" /> <span>Magma</span>
        </Link>
        <MotionButton variant="outline" size="sm" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => setLangOpen(true)} aria-label={copy.language}
          className="gap-2 bg-card/70 backdrop-blur-md border-border rounded-lg">
          <Globe className="text-muted-foreground" /><span>{currentLang.label}</span>
        </MotionButton>
      </header>
      <LanguagePickerSheet open={langOpen} current={lang} onClose={() => setLangOpen(false)} onPick={setLang} />

      <main className="flex-1 flex items-center justify-center py-5 sm:py-8">
        <motion.div initial={{ opacity: 0, y: 40, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className="w-full max-w-md min-w-0">
          <motion.div className="flex flex-col items-center mb-5 sm:mb-7" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6 }}>
            <motion.div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl magma-gradient p-0.5 magma-glow mb-3 sm:mb-5 overflow-hidden relative"
              animate={{ boxShadow: ["var(--auth-logo-glow)", "var(--auth-logo-glow-bright)", "var(--auth-logo-glow)"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
              <div className="w-full h-full rounded-2xl bg-card flex items-center justify-center overflow-hidden">
                <img src={magmaLogo} alt="Magma Chat Room" width={68} height={68} className="object-contain w-full h-full p-1" />
              </div>
              <motion.div className="absolute -inset-2 rounded-2xl -z-10 blur-sm" animate={{ rotate: 360 }}
                transition={{ duration: 18, repeat: Infinity, ease: "linear" }} style={{ background: "var(--auth-logo-halo)" }} />
            </motion.div>
            <h1 className="text-2xl sm:text-4xl font-bold text-foreground text-center leading-tight">Magma Chat Room</h1>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="glass-panel-strong rounded-xl p-5 sm:p-7 border border-border relative overflow-hidden">
            <div aria-hidden="true" className="absolute inset-x-8 top-0 h-px magma-gradient opacity-60" />
            <div className="flex rounded-lg bg-muted/60 p-1 mb-5 relative" role="tablist" aria-label={t("settings.account")}>
              {(["login", "register"] as const).map(mode => (
                <Button key={mode} id={`auth-tab-${mode}`} role="tab" aria-selected={tab === mode} aria-controls="auth-form"
                  type="button" variant="ghost" disabled={loading} onClick={() => { setTab(mode); setCapsLock(false); }}
                  className={`relative flex-1 h-10 rounded-md text-sm font-semibold z-10 hover:bg-transparent ${tab === mode ? "text-primary-foreground hover:text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {tab === mode && <motion.div layoutId="auth-tab-pill" className="absolute inset-0 magma-gradient rounded-md magma-glow-sm" transition={{ type: "spring", stiffness: 320, damping: 28 }} />}
                  <span className="relative">{mode === "login" ? copy.signIn : copy.signUp}</span>
                </Button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.form id="auth-form" role="tabpanel" aria-labelledby={`auth-tab-${tab}`} key={tab}
                initial={{ opacity: 0, x: tab === "login" ? -20 : 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: tab === "login" ? 20 : -20 }}
                transition={{ duration: 0.3 }} onSubmit={handleSubmit} className="space-y-4">
                <div className="pb-1">
                  <h2 className="text-xl font-semibold">{tab === "login" ? copy.welcome : copy.join}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{tab === "login" ? copy.loginHint : copy.registerHint}</p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="auth-username" className="text-sm font-medium">{t("auth.username")}</label>
                  <div className="relative">
                    <UserIcon size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input id="auth-username" type="text" placeholder={t("auth.username")} value={username} onChange={e => setUsername(e.target.value)}
                      required autoComplete="username" autoCapitalize="none" spellCheck={false} disabled={loading} className={fieldClass} />
                    {username && <Button variant="ghost" size="icon" type="button" disabled={loading} aria-label={copy.clear} title={copy.clear}
                      onClick={() => { setUsername(""); document.getElementById("auth-username")?.focus(); }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground"><X size={16} /></Button>}
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="auth-password" className="text-sm font-medium">{t("auth.password")}</label>
                  <div className="relative">
                    <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input id="auth-password" type={showPwd ? "text" : "password"} placeholder={t("auth.password")} value={password} onChange={e => setPassword(e.target.value)}
                      onKeyUp={e => setCapsLock(e.getModifierState("CapsLock"))} onKeyDown={e => setCapsLock(e.getModifierState("CapsLock"))} onBlur={() => setCapsLock(false)}
                      required autoComplete={tab === "login" ? "current-password" : "new-password"} disabled={loading} className={fieldClass} />
                    <Button variant="ghost" size="icon" type="button" aria-pressed={showPwd} onClick={() => setShowPwd(v => !v)} aria-label={showPwd ? copy.hide : copy.show} title={showPwd ? copy.hide : copy.show}
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:bg-muted hover:text-foreground">
                      {showPwd ? <EyeOff /> : <Eye />}
                    </Button>
                  </div>
                  {capsLock && <p role="status" className="flex items-center gap-2 text-xs text-primary"><AlertCircle size={14} />{copy.caps}</p>}
                </div>
                {tab === "register" && (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between gap-2 text-xs text-muted-foreground"><span>{copy.strength}</span><span className="text-foreground">{password ? strengthLabels[score] : "—"}</span></div>
                      <div className="flex gap-1.5" role="meter" aria-label={copy.strength} aria-valuemin={0} aria-valuemax={4} aria-valuenow={score}>
                        {[1, 2, 3, 4].map(level => <div key={level} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${level <= score ? "bg-primary" : "bg-muted"}`} />)}
                      </div>
                      <details className="group text-xs text-muted-foreground">
                        <summary className="flex items-center justify-between min-h-9 cursor-pointer list-none rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          <span>{copy.passwordTips}</span><ChevronDown size={14} className="transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="grid gap-2 pb-3 pt-1">
                          {[copy.minimum, copy.mixed, copy.number].map((label, i) => <span key={label} className={`flex items-center gap-2 ${checks[i] ? "text-foreground" : ""}`}><Check size={14} className={checks[i] ? "text-primary" : "text-muted-foreground/40"} />{label}</span>)}
                          <p className="text-muted-foreground">{copy.optional}</p>
                        </div>
                      </details>
                      <Button type="button" variant="outline" disabled={loading} onClick={generatePassword} className="w-full h-10 text-xs bg-input/30 border-border"><WandSparkles />{copy.generate}</Button>
                    </div>
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-2">
                      <label htmlFor="auth-confirm" className="text-sm font-medium">{t("auth.confirmPassword")}</label>
                      <div className="relative">
                        <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input id="auth-confirm" type={showPwd ? "text" : "password"} placeholder={t("auth.confirmPassword")} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                          required autoComplete="new-password" disabled={loading} className={fieldClass} aria-invalid={confirmPassword.length > 0 && password !== confirmPassword} />
                        {confirmPassword && password === confirmPassword && <Check size={17} className="absolute right-4 top-1/2 -translate-y-1/2 text-primary" aria-hidden="true" />}
                      </div>
                      {confirmPassword && <p role="status" className={`text-xs ${password === confirmPassword ? "text-muted-foreground" : "text-destructive"}`}>{password === confirmPassword ? copy.match : t("auth.passwordMismatch")}</p>}
                    </motion.div>
                    <motion.label initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-2.5 cursor-pointer select-none">
                      <input type="checkbox" checked={acceptTerms} disabled={loading} onChange={e => setAcceptTerms(e.target.checked)} className="mt-0.5 w-4 h-4 shrink-0 accent-primary cursor-pointer" />
                      <span className="text-xs text-muted-foreground leading-relaxed">{t("auth.termsLabel")} <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">{copy.terms}</Link></span>
                    </motion.label>
                  </>
                )}
                <MotionButton type="submit" disabled={loading} whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.98 }}
                  className="w-full h-12 rounded-lg magma-gradient text-primary-foreground font-semibold text-sm magma-glow-sm hover:magma-glow transition-all">
                  {loading ? <><motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Flame size={18} /></motion.span>{tab === "login" ? copy.signingIn : copy.creating}</>
                    : <>{tab === "login" ? copy.signIn : copy.signUp}<ArrowRight /></>}
                </MotionButton>
              </motion.form>
            </AnimatePresence>
            <div className="mt-5 pt-4 border-t border-border flex flex-wrap justify-center items-center gap-x-1 text-sm text-muted-foreground">
              <span>{tab === "login" ? t("auth.noAccount") : t("auth.hasAccount")}</span>
              <Button variant="link" disabled={loading} onClick={() => { setTab(tab === "login" ? "register" : "login"); setCapsLock(false); }} className="h-auto px-1 py-1 font-semibold">
                {tab === "login" ? t("auth.signupHere") : t("auth.loginHere")}
              </Button>
            </div>
          </motion.div>
          <footer className="text-center text-xs text-muted-foreground mt-4">
            <Link to="/terms" className="inline-flex items-center gap-1.5 min-h-8 hover:text-foreground transition-colors"><Lock size={12} />{copy.terms}</Link>
          </footer>
        </motion.div>
      </main>
    </div>
    </MotionConfig>
  );
};

export default AuthPage;

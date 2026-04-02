import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import magmaLogo from "@/assets/magma-logo.png";

interface AuthPageProps {
  onLogin: (username: string) => void;
}

const AuthPage = ({ onLogin }: AuthPageProps) => {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === "register" && password !== confirmPassword) return;
    if (username.trim()) onLogin(username.trim());
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative z-10 px-4">
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <motion.div
          className="flex flex-col items-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <motion.div
            className="w-24 h-24 rounded-2xl magma-gradient p-0.5 magma-glow mb-4 overflow-hidden"
            animate={{ boxShadow: [
              "0 0 30px hsl(24 100% 50% / 0.3), 0 0 60px hsl(24 100% 50% / 0.1)",
              "0 0 50px hsl(24 100% 50% / 0.5), 0 0 100px hsl(24 100% 50% / 0.2)",
              "0 0 30px hsl(24 100% 50% / 0.3), 0 0 60px hsl(24 100% 50% / 0.1)",
            ]}}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="w-full h-full rounded-2xl bg-card flex items-center justify-center overflow-hidden">
              <img src={magmaLogo} alt="Magma Chat Room" width={80} height={80} className="object-contain" />
            </div>
          </motion.div>
          <h1 className="text-3xl font-bold magma-gradient-text">Magma Chat Room</h1>
          <p className="text-muted-foreground mt-1">El chat que arde 🔥</p>
        </motion.div>

        {/* Card */}
        <div className="glass-panel-strong rounded-2xl p-6">
          {/* Tab switcher */}
          <div className="flex rounded-xl bg-muted p-1 mb-6">
            {(["login", "register"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                  tab === t
                    ? "magma-gradient text-primary-foreground magma-glow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "login" ? "Iniciar Sesión" : "Crear Cuenta"}
              </button>
            ))}
          </div>

          {/* Form */}
          <AnimatePresence mode="wait">
            <motion.form
              key={tab}
              initial={{ opacity: 0, x: tab === "login" ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: tab === "login" ? 20 : -20 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <div>
                <input
                  type="text"
                  placeholder="Usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 transition-all"
                />
              </div>
              <div>
                <input
                  type="password"
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 transition-all"
                />
              </div>
              {tab === "register" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <input
                    type="password"
                    placeholder="Confirmar Contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 transition-all"
                  />
                </motion.div>
              )}

              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3.5 rounded-xl magma-gradient text-primary-foreground font-semibold text-lg magma-glow transition-all hover:magma-glow-intense"
              >
                {tab === "login" ? "Entrar al Magma →" : "Crear Cuenta 🌋"}
              </motion.button>
            </motion.form>
          </AnimatePresence>

          <p className="text-center text-sm text-muted-foreground mt-4">
            {tab === "login" ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
            <button
              onClick={() => setTab(tab === "login" ? "register" : "login")}
              className="text-primary hover:underline font-medium"
            >
              {tab === "login" ? "Regístrate" : "Inicia sesión"}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;

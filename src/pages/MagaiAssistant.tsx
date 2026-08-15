import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Bot, KeyRound, Send, Sparkles, User, Eye, EyeOff, Trash2, Settings2, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import LavaParticles from "@/components/LavaParticles";
import MagmaLoader from "@/components/MagmaLoader";

interface Msg { role: "user" | "assistant"; content: string }

interface ProviderDef {
  key: string; label: string; baseUrl: string; defaultModel: string; hint: string; extraHeaders?: Record<string, string>;
}

const PROVIDERS: ProviderDef[] = [
  { key: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", defaultModel: "meta-llama/llama-3.3-70b-instruct:free", hint: "openrouter.ai/keys — muchos modelos GRATIS" },
  { key: "groq", label: "Groq", baseUrl: "https://api.groq.com/openai/v1", defaultModel: "llama-3.3-70b-versatile", hint: "console.groq.com/keys — ultra rápido" },
  { key: "google", label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", defaultModel: "gemini-2.0-flash", hint: "aistudio.google.com/apikey" },
  { key: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini", hint: "platform.openai.com/api-keys" },
  { key: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", defaultModel: "deepseek-chat", hint: "platform.deepseek.com" },
  { key: "mistral", label: "Mistral AI", baseUrl: "https://api.mistral.ai/v1", defaultModel: "mistral-small-latest", hint: "console.mistral.ai" },
  { key: "together", label: "Together AI", baseUrl: "https://api.together.xyz/v1", defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo", hint: "api.together.xyz" },
  { key: "xai", label: "xAI (Grok)", baseUrl: "https://api.x.ai/v1", defaultModel: "grok-2-latest", hint: "console.x.ai" },
  { key: "cerebras", label: "Cerebras", baseUrl: "https://api.cerebras.ai/v1", defaultModel: "llama3.3-70b", hint: "cloud.cerebras.ai" },
];

const SYSTEM = `Eres MAGAI ASSISTANT, el asistente oficial de "Magma ChatRoom", una plataforma social volcánica estilo WhatsApp + Discord + YouTube.
Conoces estas funciones y ayudas a los usuarios a usarlas, paso a paso, con un tono cálido y profesional:
- Chats privados (DM) con emojis, mensajes de voz, fotos, archivos, edición y borrado de mensajes, vaciar chat, bloquear contactos.
- Llamadas de voz y video (WebRTC) con temporizador, avisos de conexión, llamadas programadas y enlaces de llamada personalizados.
- Ubicación en tiempo real con mapa compartido por enlace.
- Grupos y comunidades tipo Discord con canales, roles (owner/moderador/miembro) e invitaciones.
- MSocialVideos: videos largos y shorts, reproductor personalizado, playlists, likes, comentarios, embeds y estrenos.
- ChatRoom Support: canal oficial de solo lectura, con tutoriales y reglas.
- Ajustes: idioma con traducción automática de todo el sitio, teclado inteligente, notificaciones, PWA en iPhone/Android.
Reglas: responde en el idioma del usuario, usa listas y pasos cortos, y si algo no existe en Magma ChatRoom dilo con honestidad. Nunca pidas contraseñas.`;

const LS = {
  provider: "magai.provider",
  key: (p: string) => `magai.key.${p}`,
  model: (p: string) => `magai.model.${p}`,
};

const SUGGESTIONS = [
  "¿Cómo comparto mi ubicación en tiempo real?",
  "¿Cómo creo un grupo con canales?",
  "¿Cómo subo un short a MSocialVideos?",
  "¿Cómo activo las notificaciones en iPhone?",
];

const MagaiAssistant = () => {
  const navigate = useNavigate();
  const [booting, setBooting] = useState(true);
  const [provider, setProvider] = useState<string>(() => localStorage.getItem(LS.provider) ?? "openrouter");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [reveal, setReveal] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const def = PROVIDERS.find((p) => p.key === provider)!;

  useEffect(() => {
    const k = localStorage.getItem(LS.key(provider)) ?? "";
    setApiKey(k);
    setModel(localStorage.getItem(LS.model(provider)) || def.defaultModel);
    localStorage.setItem(LS.provider, provider);
    setShowSetup(!k);
  }, [provider]);

  useEffect(() => { const t = setTimeout(() => setBooting(false), 900); return () => clearTimeout(t); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const saveSetup = () => {
    if (!apiKey.trim()) { toast.error("Pon tu API key"); return; }
    localStorage.setItem(LS.key(provider), apiKey.trim());
    localStorage.setItem(LS.model(provider), (model || def.defaultModel).trim());
    setShowSetup(false);
    toast.success("🔥 MAGAI listo");
  };

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || loading) return;
    if (!apiKey.trim()) { setShowSetup(true); toast.error("Primero pon tu API key"); return; }
    const next: Msg[] = [...messages, { role: "user", content: t }];
    setMessages(next); setInput(""); setLoading(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
        ...(def.extraHeaders ?? {}),
      };
      const res = await fetch(`${def.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: (model || def.defaultModel).trim(),
          messages: [{ role: "system", content: SYSTEM }, ...next],
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message ?? `Error ${res.status}`);
      const reply = data?.choices?.[0]?.message?.content ?? "(sin respuesta)";
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e: any) {
      toast.error(e.message ?? "Error de IA");
      setMessages([...next, { role: "assistant", content: `⚠️ ${e.message ?? "Error"}` }]);
    } finally { setLoading(false); }
  };

  if (booting) return <MagmaLoader label="MAGAI ASSISTANT" sub="Sincronizando el conocimiento de Magma ChatRoom…" />;

  return (
    <div className="min-h-[100dvh] bg-background relative overflow-hidden flex flex-col">
      <LavaParticles />
      <header className="relative z-10 px-3 sm:px-5 py-3 flex items-center gap-3 border-b border-border glass-panel pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button onClick={() => navigate("/")} className="p-2 rounded-xl hover:bg-muted text-muted-foreground">
          <ArrowLeft size={18} />
        </button>
        <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }}>
          <Sparkles size={18} className="text-amber-400" />
        </motion.div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm sm:text-base font-bold bg-gradient-to-r from-amber-300 to-red-500 bg-clip-text text-transparent truncate">
            MAGAI ASSISTANT
          </h1>
          <p className="text-[11px] text-muted-foreground truncate">{def.label} · {model || def.defaultModel}</p>
        </div>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} title="Limpiar" className="p-2 rounded-xl hover:bg-muted text-muted-foreground">
            <Trash2 size={16} />
          </button>
        )}
        <button onClick={() => setShowSetup((v) => !v)} className="p-2 rounded-xl hover:bg-muted text-muted-foreground">
          <Settings2 size={16} />
        </button>
      </header>

      <AnimatePresence>
        {showSetup && (
          <motion.section
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="relative z-10 overflow-hidden border-b border-border bg-gradient-to-r from-amber-500/10 to-red-500/10"
          >
            <div className="p-3 sm:p-5 max-w-2xl mx-auto space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <KeyRound size={14} className="text-amber-400" /> Tu API key se guarda solo en este dispositivo.
              </div>
              <div className="flex gap-2 overflow-x-auto scrollbar-magma pb-1 -mx-1 px-1">
                {PROVIDERS.map((p) => (
                  <button key={p.key} onClick={() => setProvider(p.key)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                      provider === p.key ? "magma-gradient text-primary-foreground border-transparent" : "border-border text-muted-foreground hover:bg-muted"
                    }`}>
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">{def.hint}</p>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input type={reveal ? "text" : "password"} value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                    placeholder="API key" autoComplete="off"
                    className="w-full px-3 py-2.5 pr-10 rounded-xl bg-input border border-border text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40" />
                  <button onClick={() => setReveal((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground">
                    {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <input value={model} onChange={(e) => setModel(e.target.value)} placeholder={def.defaultModel}
                className="w-full px-3 py-2.5 rounded-xl bg-input border border-border text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40" />
              <button onClick={saveSetup} className="w-full py-2.5 rounded-xl magma-gradient text-primary-foreground text-sm font-semibold magma-glow-sm flex items-center justify-center gap-2">
                <Check size={15} /> Guardar y usar
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <main className="relative z-10 flex-1 overflow-y-auto scrollbar-magma p-3 sm:p-5 space-y-3 max-w-2xl w-full mx-auto ember-bg">
        {messages.length === 0 && (
          <div className="py-8 text-center">
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity }} className="text-4xl mb-3">🌋</motion.div>
            <p className="text-sm text-foreground font-semibold mb-1">Pregúntame lo que sea sobre Magma ChatRoom</p>
            <p className="text-xs text-muted-foreground mb-4">Llamadas, grupos, videos, ubicación, ajustes y más.</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)}
                  className="text-xs px-3 py-2 rounded-full bg-muted hover:bg-primary/15 hover:text-primary text-muted-foreground transition-colors max-w-full">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0">
                <Bot size={14} className="text-white" />
              </div>
            )}
            <div className={`max-w-[85%] sm:max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
              m.role === "user" ? "magma-gradient text-primary-foreground rounded-br-md" : "glass-panel-strong text-foreground rounded-bl-md"
            }`}>
              <div className="prose prose-sm prose-invert max-w-none [&>p]:my-1 break-words">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            </div>
            {m.role === "user" && (
              <div className="w-7 h-7 rounded-full magma-gradient flex items-center justify-center shrink-0">
                <User size={14} className="text-primary-foreground" />
              </div>
            )}
          </motion.div>
        ))}
        {loading && (
          <div className="flex gap-2 items-center text-xs text-muted-foreground">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Bot size={14} className="text-white" />
            </div>
            <span className="flex gap-1">
              {[0, 0.2, 0.4].map((d) => (
                <motion.span key={d} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d }}>•</motion.span>
              ))}
            </span>
          </div>
        )}
        <div ref={endRef} />
      </main>

      <footer className="relative z-10 p-3 border-t border-border glass-panel pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-2xl mx-auto flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Escribe tu pregunta…"
            className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-ring/40" />
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => send(input)} disabled={loading || !input.trim()}
            className="px-4 rounded-xl magma-gradient text-primary-foreground disabled:opacity-50 magma-glow-sm">
            <Send size={18} />
          </motion.button>
        </div>
      </footer>
    </div>
  );
};

export default MagaiAssistant;

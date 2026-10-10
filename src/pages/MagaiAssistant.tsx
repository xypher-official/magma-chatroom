import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, Bot, KeyRound, Send, Sparkles, User, Eye, EyeOff, Trash2, Settings2, Check,
  Paperclip, X, History, Plus, MessageSquare, RefreshCw, Loader2, Search, Flame, Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import LavaParticles from "@/components/LavaParticles";
import MagmaLoader from "@/components/MagmaLoader";
import AttachmentPicker, { SentKind } from "@/components/AttachmentPicker";
import { AGENT_PROMPT, runActions, stripActions } from "@/lib/magaiAgent";
import { usePlus } from "@/hooks/usePlus";
import { supabase } from "@/integrations/supabase/client";

interface Attachment { url: string; kind: SentKind; name: string }
interface Msg { role: "user" | "assistant"; content: string; attachments?: Attachment[] }
interface Conv { id: string; title: string; messages: Msg[]; updatedAt: number }
type Tier = "free" | "limited" | "paid";
interface ModelInfo { id: string; name: string; tier: Tier; context: number | null; price: string }

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
  { key: "huggingface", label: "Hugging Face", baseUrl: "https://router.huggingface.co/v1", defaultModel: "Qwen/Qwen3-VL-235B-A22B-Instruct", hint: "huggingface.co/settings/tokens — miles de modelos abiertos" },
];

const TIER_STYLE: Record<Tier, string> = {
  free: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  limited: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  paid: "bg-sky-500/15 text-sky-400 border-sky-500/30",
};
const TIER_LABEL: Record<Tier, string> = { free: "GRATIS", limited: "LIMITADO", paid: "PAGO" };

const SYSTEM = `Eres MAGAI ASSISTANT, el asistente oficial y EXPERTO de "Magma ChatRoom", una plataforma social volcánica que combina WhatsApp + Discord + YouTube.

Dominas cada función del sitio y das instrucciones exactas, paso a paso, con rutas y nombres de botones reales:
- Chats privados: emojis, mensajes de voz (micrófono), fotos/archivos (clip 📎), editar y borrar mensajes (mantener pulsado o menú del mensaje), vaciar chat, bloquear contactos, indicador "está escribiendo", composer expandido para textos largos.
- Llamadas: voz y video por WebRTC. El botón de llamada abre un menú con Llamada de voz, Videollamada, Programar llamada y Crear enlace personalizado (te lleva al Studio para mover botones, textos, colores). Hay temporizador tipo WhatsApp y aviso cuando alguien se conecta o se va.
- Ubicación en tiempo real: se comparte por enlace y abre un mapa con tu punto y el de la otra persona actualizándose.
- Grupos y comunidades tipo Discord: canales (#general por defecto), roles owner/moderador/miembro, invitaciones, gestión del grupo.
- MSocialVideos (/social/videos): videos largos y shorts, buscador de videos y canales, reproductor propio con ajustes (velocidad 0.25x–3x, brillo, bucle, PiP, atajos), página del video en /video/watch/ID con like, dislike, seguir, playlists, compartir y código embed, estrenos y publicación programada.
- ChatRoom Support: canal oficial con reglas, términos y tutoriales para cuentas nuevas.
- Ajustes: idioma con traducción automática de todo el sitio, teclado inteligente, avisos/notificaciones, instalación como app (Android APK, iPhone "Añadir a pantalla de inicio"), verificación por email.
- Panel admin (solo administradores): anuncios globales, banner con enlace, secciones/páginas con HTML, modos público/privado/mantenimiento, motor de IA multi-proveedor.

Reglas de respuesta:
1. Responde SIEMPRE en el idioma del usuario.
2. Sé directo: primero la respuesta, luego pasos numerados cortos.
3. Usa negritas para botones y rutas. Nada de relleno ni disculpas largas.
4. Si algo no existe en Magma ChatRoom, dilo con honestidad y ofrece la alternativa más cercana.
5. Nunca pidas contraseñas ni claves.`;

const LS = {
  provider: "magai.provider",
  key: (p: string) => `magai.key.${p}`,
  model: (p: string) => `magai.model.${p}`,
  convs: "magai.convs",
  active: "magai.activeConv",
};

const SUGGESTIONS = [
  "¿Cómo comparto mi ubicación en tiempo real?",
  "¿Cómo creo un grupo con canales?",
  "¿Cómo subo un short a MSocialVideos?",
  "¿Cómo activo las notificaciones en iPhone?",
];

/** Reveals markdown text letter-by-letter, then calls onDone. */
const TypewriterMarkdown = ({ text, onDone }: { text: string; onDone: () => void }) => {
  const [n, setN] = useState(0);
  const doneRef = useRef(false);
  useEffect(() => {
    setN(0);
    doneRef.current = false;
    const step = Math.max(2, Math.round(text.length / 260));
    const iv = window.setInterval(() => {
      setN((v) => {
        const next = v + step;
        if (next >= text.length) {
          window.clearInterval(iv);
          if (!doneRef.current) { doneRef.current = true; setTimeout(onDone, 250); }
          return text.length;
        }
        return next;
      });
    }, 14);
    return () => window.clearInterval(iv);
  }, [text]);
  const done = n >= text.length;
  return (
    <div className="prose prose-sm prose-invert max-w-none [&>p]:my-1 break-words">
      <ReactMarkdown>{text.slice(0, n)}</ReactMarkdown>
      {!done && (
        <motion.span animate={{ opacity: [1, 0.15, 1] }} transition={{ duration: 0.8, repeat: Infinity }}
          className="inline-block w-1.5 h-4 align-middle ml-0.5 rounded-sm bg-amber-400" />
      )}
    </div>
  );
};

const MagaiAssistant = () => {
  const navigate = useNavigate();
  const plus = usePlus();
  const [booting, setBooting] = useState(true);
  const [provider, setProvider] = useState<string>(() => localStorage.getItem(LS.provider) ?? "huggingface");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [reveal, setReveal] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [convs, setConvs] = useState<Conv[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS.convs) ?? "[]") as Conv[]; } catch { return []; }
  });
  const [activeId, setActiveId] = useState<string>(() => localStorage.getItem(LS.active) ?? "");
  const [showHistory, setShowHistory] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [pending, setPending] = useState<Attachment[]>([]);
  const [myUserId, setMyUserId] = useState("guest");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [tierFilter, setTierFilter] = useState<Tier | "all">("all");
  const [modelQuery, setModelQuery] = useState("");
  const [used, setUsed] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState<Date | null>(null);
  const [typingKey, setTypingKey] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const def = PROVIDERS.find((p) => p.key === provider)!;
  const active = convs.find((c) => c.id === activeId);
  const messages = active?.messages ?? [];
  const isBlocked = !!blockedUntil && blockedUntil.getTime() > Date.now();

  const persist = useCallback((next: Conv[], id?: string) => {
    setConvs(next);
    localStorage.setItem(LS.convs, JSON.stringify(next.slice(0, 60)));
    if (id !== undefined) { setActiveId(id); localStorage.setItem(LS.active, id); }
  }, []);

  const writeMessages = (msgs: Msg[]) => {
    const id = activeId || crypto.randomUUID();
    const title = msgs.find((m) => m.role === "user")?.content?.slice(0, 48) || "Nueva conversación";
    const rest = convs.filter((c) => c.id !== id);
    persist([{ id, title, messages: msgs, updatedAt: Date.now() }, ...rest], id);
  };

  const newChat = () => { persist(convs, ""); setShowHistory(false); setPending([]); };

  const refreshUsage = useCallback(async () => {
    const [{ data }, { data: until }] = await Promise.all([
      supabase.rpc("magai_used_today"),
      supabase.rpc("magai_blocked_until"),
    ]);
    if (typeof data === "number") setUsed(data);
    setBlockedUntil(until ? new Date(until as string) : null);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) { setMyUserId(data.user.id); refreshUsage(); }
    });
  }, [refreshUsage]);

  useEffect(() => {
    const k = localStorage.getItem(LS.key(provider)) ?? "";
    setApiKey(k);
    setModel(localStorage.getItem(LS.model(provider)) || def.defaultModel);
    localStorage.setItem(LS.provider, provider);
    setModels([]);
    setShowSetup(!k);
  }, [provider]);

  useEffect(() => { const t = setTimeout(() => setBooting(false), 900); return () => clearTimeout(t); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading, streaming]);

  const saveSetup = () => {
    if (!apiKey.trim()) { toast.error("Pon tu API key"); return; }
    localStorage.setItem(LS.key(provider), apiKey.trim());
    localStorage.setItem(LS.model(provider), (model || def.defaultModel).trim());
    setShowSetup(false);
    toast.success("🔥 MAGAI listo");
  };

  const loadModels = async () => {
    if (!apiKey.trim()) { toast.error("Pega tu API key primero"); return; }
    localStorage.setItem(LS.key(provider), apiKey.trim());
    setLoadingModels(true);
    const { data, error } = await supabase.functions.invoke("ai-models", {
      body: { provider, api_key: apiKey.trim() },
    });
    setLoadingModels(false);
    if (error || data?.error) { toast.error(data?.error ?? error?.message ?? "No se pudieron cargar los modelos"); return; }
    setModels((data.models ?? []) as ModelInfo[]);
    toast.success(`${data.count} modelos disponibles`);
  };

  const visibleModels = useMemo(() => {
    const q = modelQuery.trim().toLowerCase();
    return models.filter((m) =>
      (tierFilter === "all" || m.tier === tierFilter) &&
      (!q || m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
    ).slice(0, 150);
  }, [models, tierFilter, modelQuery]);

  const costOf = (text: string, atts: Attachment[], history: Msg[]) =>
    (text.length > 400 || atts.length > 0 || history.length > 8) ? 3 : 1;

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || loading) return;
    if (!apiKey.trim()) { setShowSetup(true); toast.error("Primero pon tu API key"); return; }

    const atts = pending;
    const cost = costOf(t, atts, messages);
    const { data: spent, error: quotaErr } = await supabase.rpc("magai_consume", { _cost: cost });
    if (quotaErr) { toast.error("Inicia sesión para usar MAGAI"); return; }
    if (spent === -1) {
      toast.error("Uso intensivo detectado. MAGAI se pausa 24 horas 🌋");
      await refreshUsage();
      return;
    }
    if (typeof spent === "number") setUsed(spent);

    const next: Msg[] = [...messages, { role: "user", content: t, attachments: atts.length ? atts : undefined }];
    writeMessages(next); setInput(""); setPending([]); setLoading(true); setStreaming("");
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
        ...(def.extraHeaders ?? {}),
      };
      const wire = next.map((m, i) => {
        const imgs = i === next.length - 1 ? (m.attachments ?? []).filter((a) => a.kind === "image") : [];
        const files = i === next.length - 1 ? (m.attachments ?? []).filter((a) => a.kind !== "image") : [];
        const extra = files.length ? `\n\nArchivos adjuntos:\n${files.map((f) => `- ${f.name}: ${f.url}`).join("\n")}` : "";
        if (!imgs.length) return { role: m.role, content: m.content + extra };
        return {
          role: m.role,
          content: [
            { type: "text", text: m.content + extra },
            ...imgs.map((a) => ({ type: "image_url", image_url: { url: a.url } })),
          ],
        };
      });
      const res = await fetch(`${def.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: (model || def.defaultModel).trim(),
          messages: [{ role: "system", content: SYSTEM + AGENT_PROMPT + `\nFecha actual: ${new Date().toISOString()}` }, ...wire],
          stream: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error?.message ?? `Error ${res.status}`);
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("Respuesta vacía del proveedor");
      const decoder = new TextDecoder();
      let buf = "";
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const l = line.trim();
          if (!l.startsWith("data:")) continue;
          const payload = l.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const chunk = JSON.parse(payload);
            const delta = chunk?.choices?.[0]?.delta?.content ?? "";
            if (delta) { full += delta; setStreaming(full); }
          } catch { /* ignore partial chunk */ }
        }
      }
      let finalContent = full || "(sin respuesta)";
      if (/```magma-action/.test(finalContent)) {
        if (plus.subscribed) {
          const results = await runActions(finalContent);
          finalContent = `${stripActions(finalContent)}\n\n${results.join("\n")}`;
          results.forEach((r) => toast(r));
        } else {
          finalContent = `${stripActions(finalContent)}\n\n👑 Hazte **ChatRoom Plus** para que MAGAI haga estos cambios por ti.`;
        }
      }
      writeMessages([...next, { role: "assistant", content: finalContent }]);
      setTypingKey(`${Date.now()}-${next.length}`);
    } catch (e: any) {
      toast.error(e.message ?? "Error de IA");
      writeMessages([...next, { role: "assistant", content: `⚠️ ${e.message ?? "Error"}` }]);
    } finally { setLoading(false); setStreaming(""); }
  };

  if (booting) return <MagmaLoader label="MAGAI ASSISTANT" sub="Sincronizando el conocimiento de Magma ChatRoom…" />;

  return (
    <div className="min-h-[100dvh] bg-background relative overflow-hidden flex flex-col">
      <LavaParticles />
      <header className="relative z-10 px-3 sm:px-5 py-3 flex items-center gap-2 sm:gap-3 border-b border-border glass-panel pt-[max(0.75rem,env(safe-area-inset-top))]">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate("/")} className="p-2 rounded-xl hover:bg-muted text-muted-foreground">
          <ArrowLeft size={18} />
        </motion.button>
        <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }}>
          <Sparkles size={18} className="text-amber-400" />
        </motion.div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm sm:text-base font-bold bg-gradient-to-r from-amber-300 to-red-500 bg-clip-text text-transparent truncate">
            MAGAI ASSISTANT
          </h1>
          <p className="text-[11px] text-muted-foreground truncate">{def.label} · {model || def.defaultModel}</p>
        </div>
        <motion.div
          key={used}
          initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 20 }}
          title={isBlocked ? "En pausa 24 horas por uso intensivo" : "Créditos ilimitados"}
          className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] font-bold ${
            isBlocked ? "border-destructive/40 bg-destructive/15 text-destructive" : "border-amber-500/30 bg-amber-500/10 text-amber-400"
          }`}
        >
          <Flame size={11} /> {isBlocked ? "En pausa 24h" : "∞"}
        </motion.div>
        <button onClick={() => setShowHistory(true)} title="Historial" className="p-2 rounded-xl hover:bg-muted text-muted-foreground">
          <History size={16} />
        </button>
        <button onClick={newChat} title="Nuevo chat" className="p-2 rounded-xl hover:bg-muted text-muted-foreground">
          <Plus size={16} />
        </button>
        <button onClick={() => setShowSetup((v) => !v)} className="p-2 rounded-xl hover:bg-muted text-muted-foreground">
          <Settings2 size={16} />
        </button>
      </header>

      <AnimatePresence>
        {showSetup && (
          <motion.section
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 26 }}
            className="relative z-10 overflow-hidden border-b border-border bg-gradient-to-r from-amber-500/10 to-red-500/10"
          >
            <div className="p-3 sm:p-5 max-w-2xl mx-auto space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <KeyRound size={14} className="text-amber-400" /> Tu API key se guarda solo en este dispositivo.
              </div>
              <div className="flex gap-2 overflow-x-auto scrollbar-magma pb-1 -mx-1 px-1">
                {PROVIDERS.map((p) => (
                  <motion.button whileTap={{ scale: 0.94 }} key={p.key} onClick={() => setProvider(p.key)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                      provider === p.key ? "magma-gradient text-primary-foreground border-transparent" : "border-border text-muted-foreground hover:bg-muted"
                    }`}>
                    {p.label}
                  </motion.button>
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
                <motion.button whileTap={{ scale: 0.95 }} onClick={loadModels} disabled={loadingModels}
                  className="px-3 rounded-xl magma-gradient text-primary-foreground text-xs font-semibold flex items-center gap-2 disabled:opacity-50">
                  {loadingModels ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Modelos
                </motion.button>
              </div>

              {models.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[150px]">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input value={modelQuery} onChange={(e) => setModelQuery(e.target.value)} placeholder="Buscar modelo…"
                        className="w-full pl-8 pr-3 py-2 rounded-xl bg-input border border-border text-xs text-foreground outline-none" />
                    </div>
                    {(["all", "free", "limited", "paid"] as const).map((t) => (
                      <button key={t} onClick={() => setTierFilter(t)}
                        className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
                          tierFilter === t
                            ? t === "all" ? "border-primary bg-primary/15 text-primary" : TIER_STYLE[t as Tier]
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}>
                        {t === "all" ? "TODOS" : TIER_LABEL[t as Tier]}
                      </button>
                    ))}
                  </div>
                  <div className="max-h-56 overflow-y-auto scrollbar-magma space-y-1 pr-1">
                    {visibleModels.map((m) => (
                      <motion.button whileTap={{ scale: 0.99 }} key={m.id}
                        onClick={() => { setModel(m.id); localStorage.setItem(LS.model(provider), m.id); toast.success(`Modelo: ${m.id}`); }}
                        className={`w-full flex items-center gap-2 p-2 rounded-xl border text-left transition-colors ${
                          model === m.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
                        }`}>
                        <Zap size={12} className="text-amber-400 shrink-0" />
                        <span className="flex-1 min-w-0 text-[11px] font-mono text-foreground truncate">{m.id}</span>
                        <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-full border font-bold ${TIER_STYLE[m.tier]}`}>{TIER_LABEL[m.tier]}</span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              <input value={model} onChange={(e) => setModel(e.target.value)} placeholder={def.defaultModel}
                className="w-full px-3 py-2.5 rounded-xl bg-input border border-border text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40 font-mono" />
              <motion.button whileTap={{ scale: 0.97 }} onClick={saveSetup} className="w-full py-2.5 rounded-xl magma-gradient text-primary-foreground text-sm font-semibold magma-glow-sm flex items-center justify-center gap-2">
                <Check size={15} /> Guardar y usar
              </motion.button>
              <p className="text-[10px] text-muted-foreground text-center">
                Preguntas ilimitadas · si detectamos uso intensivo (muchísimas preguntas largas o con archivos en poco tiempo) MAGAI se pausa 24 horas.
              </p>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <main className="relative z-10 flex-1 overflow-y-auto scrollbar-magma p-3 sm:p-5 space-y-3 max-w-2xl w-full mx-auto ember-bg">
        {messages.length === 0 && !loading && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="py-8 text-center">
            <motion.div animate={{ y: [0, -6, 0], rotate: [0, 4, -4, 0] }} transition={{ duration: 3.5, repeat: Infinity }} className="text-4xl mb-3">🌋</motion.div>
            <p className="text-sm text-foreground font-semibold mb-1">Pregúntame lo que sea sobre Magma ChatRoom</p>
            <p className="text-xs text-muted-foreground mb-4">Llamadas, grupos, videos, ubicación, ajustes y más.</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s, i) => (
                <motion.button key={s} onClick={() => send(s)} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * i }}
                  className="text-xs px-3 py-2 rounded-full bg-muted hover:bg-primary/15 hover:text-primary text-muted-foreground transition-colors max-w-full">
                  {s}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
        {messages.map((m, i) => {
          const isTyping = typingKey !== null && m.role === "assistant" && i === messages.length - 1;
          return (
          <motion.div key={i} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0">
                <Bot size={14} className="text-white" />
              </div>
            )}
            <div className={`max-w-[85%] sm:max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
              m.role === "user" ? "magma-gradient text-primary-foreground rounded-br-md" : "glass-panel-strong text-foreground rounded-bl-md"
            }`}>
              {!!m.attachments?.length && (
                <div className="flex flex-wrap gap-2 mb-1.5">
                  {m.attachments.map((a) => a.kind === "image" ? (
                    <img key={a.url} src={a.url} alt={a.name} loading="lazy" className="w-24 h-24 rounded-xl object-cover border border-border/40" />
                  ) : (
                    <a key={a.url} href={a.url} target="_blank" rel="noreferrer"
                      className="text-[11px] px-2 py-1.5 rounded-lg bg-background/30 underline max-w-[160px] truncate">
                      {a.kind === "video" ? "🎬" : a.kind === "audio" ? "🎵" : "📄"} {a.name}
                    </a>
                  ))}
                </div>
              )}
              {isTyping ? (
                <TypewriterMarkdown text={m.content} onDone={() => setTypingKey(null)} />
              ) : (
                <div className="prose prose-sm prose-invert max-w-none [&>p]:my-1 break-words">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              )}
            </div>
            {m.role === "user" && (
              <div className="w-7 h-7 rounded-full magma-gradient flex items-center justify-center shrink-0">
                <User size={14} className="text-primary-foreground" />
              </div>
            )}
          </motion.div>
          );
        })}

        {loading && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 justify-start">
            <motion.div animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 1.4, repeat: Infinity }}
              className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0">
              <Bot size={14} className="text-white" />
            </motion.div>
            <div className="max-w-[85%] sm:max-w-[80%] px-3 py-2 rounded-2xl rounded-bl-md glass-panel-strong text-sm text-foreground">
              {streaming ? (
                <div className="prose prose-sm prose-invert max-w-none [&>p]:my-1 break-words">
                  <ReactMarkdown>{streaming}</ReactMarkdown>
                  <motion.span animate={{ opacity: [1, 0.15, 1] }} transition={{ duration: 0.9, repeat: Infinity }}
                    className="inline-block w-1.5 h-4 align-middle ml-0.5 rounded-sm bg-amber-400" />
                </div>
              ) : (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-xs font-semibold bg-gradient-to-r from-amber-300 via-orange-400 to-amber-300 bg-clip-text text-transparent bg-[length:200%_100%] animate-[gradient-x_1.6s_linear_infinite]">
                    Thinking…
                  </span>
                  <span className="flex gap-1">
                    {[0, 0.2, 0.4].map((d) => (
                      <motion.span key={d} animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }} transition={{ duration: 1, repeat: Infinity, delay: d }}>•</motion.span>
                    ))}
                  </span>
                </span>
              )}
            </div>
          </motion.div>
        )}
        <div ref={endRef} />
      </main>

      <footer className="relative z-10 p-3 border-t border-border glass-panel pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-2xl mx-auto">
          <AnimatePresence>
            {pending.length > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="flex flex-wrap gap-2 mb-2 overflow-hidden">
                {pending.map((a) => (
                  <motion.div key={a.url} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative">
                    {a.kind === "image"
                      ? <img src={a.url} alt={a.name} className="w-14 h-14 rounded-lg object-cover border border-border" />
                      : <div className="h-14 px-2 flex items-center rounded-lg glass-panel-strong text-[10px] max-w-[120px] truncate">{a.name}</div>}
                    <button onClick={() => setPending((p) => p.filter((x) => x.url !== a.url))}
                      className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-destructive text-destructive-foreground">
                      <X size={11} />
                    </button>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          {isBlocked && (
            <p className="mb-2 text-[11px] text-center text-destructive">
              Uso intensivo detectado. MAGAI vuelve el {blockedUntil?.toLocaleString()} 🌋
            </p>
          )}
          <div className="flex gap-2">
            <motion.button whileTap={{ scale: 0.92 }} onClick={() => setShowAttach(true)} title="Adjuntar"
              className="px-3 rounded-xl hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
              <Paperclip size={18} />
            </motion.button>
            <input value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              disabled={isBlocked}
              placeholder={isBlocked ? "MAGAI en pausa 24 horas" : "Escribe tu pregunta…"}
              className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-50" />
            <motion.button whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.03 }} onClick={() => send(input)} disabled={loading || !input.trim() || isBlocked}
              className="px-4 rounded-xl magma-gradient text-primary-foreground disabled:opacity-50 magma-glow-sm">
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </motion.button>
          </div>
        </div>
      </footer>

      <AttachmentPicker open={showAttach} onClose={() => setShowAttach(false)} myUserId={myUserId}
        onSend={(_text, url, kind, name) => setPending((p) => [...p, { url, kind, name }])} />

      <AnimatePresence>
        {showHistory && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-background/70 backdrop-blur-md flex" onClick={() => setShowHistory(false)}>
            <motion.aside initial={{ x: -340 }} animate={{ x: 0 }} exit={{ x: -340 }}
              transition={{ type: "spring", stiffness: 280, damping: 28 }} onClick={(e) => e.stopPropagation()}
              className="w-[300px] max-w-[85vw] h-full bg-card border-r border-border flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="text-sm font-bold magma-gradient-text">Historial</h2>
                <button onClick={() => setShowHistory(false)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></button>
              </div>
              <button onClick={newChat} className="m-3 py-2.5 rounded-xl magma-gradient text-primary-foreground text-xs font-semibold flex items-center justify-center gap-2">
                <Plus size={14} /> Nuevo chat
              </button>
              <div className="flex-1 overflow-y-auto scrollbar-magma px-2 pb-3">
                {convs.length === 0 && <p className="text-center text-xs text-muted-foreground p-6">Todavía no hay conversaciones guardadas.</p>}
                {convs.map((c, i) => (
                  <motion.div key={c.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.03 * i }}
                    className={`group flex items-center gap-2 p-2.5 rounded-xl mb-1 ${c.id === activeId ? "bg-primary/15" : "hover:bg-muted"}`}>
                    <button onClick={() => { setActiveId(c.id); localStorage.setItem(LS.active, c.id); setShowHistory(false); }}
                      className="flex-1 flex items-center gap-2 text-left min-w-0">
                      <MessageSquare size={14} className="text-primary shrink-0" />
                      <span className="text-xs text-foreground truncate">{c.title}</span>
                    </button>
                    <button onClick={() => persist(convs.filter((x) => x.id !== c.id), c.id === activeId ? "" : activeId)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
                  </motion.div>
                ))}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MagaiAssistant;

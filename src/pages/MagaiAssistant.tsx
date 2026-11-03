import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, Bot, Send, Sparkles, User, Trash2,
  Paperclip, X, History, Plus, MessageSquare, Loader2, Flame,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import LavaParticles from "@/components/LavaParticles";
import MagmaLoader from "@/components/MagmaLoader";
import AttachmentPicker, { SentKind } from "@/components/AttachmentPicker";
import { runActions, stripActions } from "@/lib/magaiAgent";
import { usePlus } from "@/hooks/usePlus";
import { supabase } from "@/integrations/supabase/client";
import { requestSpaceAssistant } from "@/lib/spaceAssistant";
import { useSpaceConsent } from "@/components/SpacePrivacyDialog";
import { Button } from "@/components/ui/button";

interface Attachment { url: string; kind: SentKind; name: string }
interface Msg { role: "user" | "assistant"; content: string; attachments?: Attachment[] }
interface Conv { id: string; title: string; messages: Msg[]; updatedAt: number }
const MotionButton = motion.create(Button);

const LS = { convs: "magai.convs", active: "magai.activeConv" };

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
          className="inline-block w-1.5 h-4 align-middle ml-0.5 rounded-sm bg-primary" />
      )}
    </div>
  );
};

const MagaiAssistant = () => {
  const navigate = useNavigate();
  const plus = usePlus();
  const consent = useSpaceConsent();
  const sendingRef = useRef(false);
  const [booting, setBooting] = useState(true);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [convs, setConvs] = useState<Conv[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS.convs) ?? "[]") as Conv[]; } catch { return []; }
  });
  const [activeId, setActiveId] = useState<string>(() => localStorage.getItem(LS.active) ?? "");
  const [showHistory, setShowHistory] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [pending, setPending] = useState<Attachment[]>([]);
  const [myUserId, setMyUserId] = useState("guest");
  const [used, setUsed] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState<Date | null>(null);
  const [typingKey, setTypingKey] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => { const t = setTimeout(() => setBooting(false), 900); return () => clearTimeout(t); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || sendingRef.current || isBlocked) return;
    if (t.length > 24000) { toast.error("La pregunta es demasiado larga (máximo 24.000 caracteres)."); return; }
    sendingRef.current = true;
    if (!(await consent.request())) { sendingRef.current = false; return; }
    const atts = pending;
    const next: Msg[] = [...messages, { role: "user", content: t, attachments: atts.length ? atts : undefined }];
    writeMessages(next); setInput(""); setPending([]); setLoading(true); setTypingKey(null);
    try {
      const data = await requestSpaceAssistant("magai-space", next);
      if (typeof data.used === "number") setUsed(data.used);
      let finalContent = data.reply;
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
    } finally { setLoading(false); sendingRef.current = false; void refreshUsage(); }
  };

  if (booting) return <MagmaLoader label="MAGAI ASSISTANT" sub="Sincronizando el conocimiento de Magma ChatRoom…" />;

  return (
    <div className="h-[100dvh] bg-background relative overflow-hidden flex flex-col">
      <LavaParticles />
      <header className="relative z-10 px-3 sm:px-5 py-3 flex items-center gap-2 sm:gap-3 border-b border-border glass-panel pt-[max(0.75rem,env(safe-area-inset-top))]">
        <MotionButton variant="ghost" whileTap={{ scale: 0.9 }} onClick={() => navigate("/")} className="p-2 rounded-xl hover:bg-muted text-muted-foreground">
          <ArrowLeft size={18} />
        </MotionButton>
        <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }}>
          <Sparkles size={18} className="text-primary" />
        </motion.div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm sm:text-base font-bold magma-gradient-text truncate">
            MAGAI ASSISTANT
          </h1>
          <p className="text-[11px] text-muted-foreground truncate">MiniCPM-V 4.7 · Hugging Face</p>
        </div>
        <motion.div
          key={used}
          initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 20 }}
          title={isBlocked ? "En pausa 24 horas por uso intensivo" : "Créditos ilimitados"}
          className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] font-bold ${
            isBlocked ? "border-destructive/40 bg-destructive/15 text-destructive" : "border-primary/30 bg-primary/10 text-primary"
          }`}
        >
          <Flame size={11} /> {isBlocked ? "En pausa 24h" : "∞"}
        </motion.div>
        <Button variant="ghost" onClick={() => setShowHistory(true)} title="Historial" aria-label="Historial" className="p-2 rounded-xl hover:bg-muted text-muted-foreground">
          <History size={16} />
        </Button>
        <Button variant="ghost" onClick={newChat} title="Nuevo chat" aria-label="Nuevo chat" className="p-2 rounded-xl hover:bg-muted text-muted-foreground">
          <Plus size={16} />
        </Button>
      </header>

      <main className="relative z-10 flex-1 min-h-0 overflow-y-auto scrollbar-magma p-3 sm:p-5 space-y-3 max-w-2xl w-full mx-auto ember-bg">
        {messages.length === 0 && !loading && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="py-8 text-center">
            <motion.div animate={{ y: [0, -6, 0], rotate: [0, 4, -4, 0] }} transition={{ duration: 3.5, repeat: Infinity }} className="text-4xl mb-3">🌋</motion.div>
            <p className="text-sm text-foreground font-semibold mb-1">Pregúntame lo que sea sobre Magma ChatRoom</p>
            <p className="text-xs text-muted-foreground mb-4">Llamadas, grupos, videos, ubicación, ajustes y más.</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s, i) => (
                <MotionButton variant="ghost" key={s} onClick={() => send(s)} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * i }}
                  className="text-xs px-3 py-2 rounded-full bg-muted hover:bg-primary/15 hover:text-primary text-muted-foreground transition-colors max-w-full">
                  {s}
                </MotionButton>
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
              <div className="w-7 h-7 rounded-full magma-gradient flex items-center justify-center shrink-0">
                <Bot size={14} className="text-primary-foreground" />
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
              className="w-7 h-7 rounded-full magma-gradient flex items-center justify-center shrink-0">
              <Bot size={14} className="text-primary-foreground" />
            </motion.div>
            <div className="max-w-[85%] sm:max-w-[80%] px-3 py-2 rounded-2xl rounded-bl-md glass-panel-strong text-sm text-foreground">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-xs font-semibold magma-gradient-text animate-pulse">
                    Thinking…
                  </span>
                  <span className="flex gap-1">
                    {[0, 0.2, 0.4].map((d) => (
                      <motion.span key={d} animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }} transition={{ duration: 1, repeat: Infinity, delay: d }}>•</motion.span>
                    ))}
                  </span>
                </span>
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
                    <Button variant="ghost" onClick={() => setPending((p) => p.filter((x) => x.url !== a.url))}
                      className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-destructive text-destructive-foreground">
                      <X size={11} />
                    </Button>
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
            <MotionButton variant="ghost" whileTap={{ scale: 0.92 }} onClick={() => setShowAttach(true)} title="Adjuntar"
              className="px-3 rounded-xl hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
              <Paperclip size={18} />
            </MotionButton>
            <input value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              disabled={isBlocked}
              placeholder={isBlocked ? "MAGAI en pausa 24 horas" : "Escribe tu pregunta…"}
              className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-50" />
            <MotionButton variant="ghost" whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.03 }} aria-label="Enviar pregunta" onClick={() => send(input)} disabled={loading || !input.trim() || isBlocked}
              className="px-4 rounded-xl magma-gradient text-primary-foreground disabled:opacity-50 magma-glow-sm">
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </MotionButton>
          </div>
        </div>
      </footer>

      {consent.dialog}
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
                <Button variant="ghost" onClick={() => setShowHistory(false)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></Button>
              </div>
              <Button variant="ghost" onClick={newChat} className="m-3 py-2.5 rounded-xl magma-gradient text-primary-foreground text-xs font-semibold flex items-center justify-center gap-2">
                <Plus size={14} /> Nuevo chat
              </Button>
              <div className="flex-1 overflow-y-auto scrollbar-magma px-2 pb-3">
                {convs.length === 0 && <p className="text-center text-xs text-muted-foreground p-6">Todavía no hay conversaciones guardadas.</p>}
                {convs.map((c, i) => (
                  <motion.div key={c.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.03 * i }}
                    className={`group flex items-center gap-2 p-2.5 rounded-xl mb-1 ${c.id === activeId ? "bg-primary/15" : "hover:bg-muted"}`}>
                    <Button variant="ghost" onClick={() => { setActiveId(c.id); localStorage.setItem(LS.active, c.id); setShowHistory(false); }}
                      className="flex-1 flex items-center gap-2 text-left min-w-0">
                      <MessageSquare size={14} className="text-primary shrink-0" />
                      <span className="text-xs text-foreground truncate">{c.title}</span>
                    </Button>
                    <Button variant="ghost" onClick={() => persist(convs.filter((x) => x.id !== c.id), c.id === activeId ? "" : activeId)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive"><Trash2 size={13} /></Button>
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

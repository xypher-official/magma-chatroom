import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Sparkles, Bot, User } from "lucide-react";
import { requestSpaceAssistant } from "@/lib/spaceAssistant";
import { useSpaceConsent } from "@/components/SpacePrivacyDialog";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Msg { role: "user" | "assistant"; content: string }

const SUGGESTIONS = [
  "elimina la cuenta de @ejemplo",
  "verifica a @ejemplo",
  "manda broadcast: 🌋 Mantenimiento esta noche",
  "dame las estadísticas",
];

const AdminAIConsole = () => {
  const consent = useSpaceConsent();
  const sending = useRef(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || sending.current) return;
    sending.current = true;
    if (!(await consent.request())) { sending.current = false; return; }
    const next = [...messages, { role: "user" as const, content: t }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const data = await requestSpaceAssistant("admin-ai", next);
      setMessages([...next, { role: "assistant", content: data.reply ?? "(sin respuesta)" }]);
    } catch (e: any) {
      toast.error(e.message ?? "Error de IA");
      setMessages([...next, { role: "assistant", content: `⚠️ ${e.message ?? "Error"}` }]);
    } finally {
      setLoading(false);
      sending.current = false;
    }
  };

  return (
    <div className="flex flex-col h-[60vh] min-w-0">
      {consent.dialog}
      <div className="flex items-center gap-2 mb-3">
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles size={18} className="text-amber-400" />
        </motion.div>
        <h3 className="text-sm font-semibold text-foreground">Consola MAGMA-AI</h3>
        <span className="text-xs text-muted-foreground">· MiniCPM-V 4.7</span>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-magma rounded-xl border border-border bg-background/60 p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-3">Ejemplos:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-primary/15 hover:text-primary text-muted-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0">
                <Bot size={14} className="text-white" />
              </div>
            )}
            <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
              m.role === "user"
                ? "magma-gradient text-primary-foreground rounded-br-md"
                : "glass-panel-strong text-foreground rounded-bl-md"
            }`}>
              <div className="prose prose-sm prose-invert max-w-none [&>p]:my-1">
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
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex gap-2 items-center text-xs text-muted-foreground"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Bot size={14} className="text-white" />
            </div>
            <span className="flex gap-1">
              <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity }}>•</motion.span>
              <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}>•</motion.span>
              <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}>•</motion.span>
            </span>
          </motion.div>
        )}
        <div ref={endRef} />
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder="Ej: elimina @spam o verifica a Juan"
          className="flex-1 px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-ring/50"
        />
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => send(input)} disabled={loading || !input.trim()}
          className="px-4 rounded-xl magma-gradient text-primary-foreground disabled:opacity-50 magma-glow-sm"
        >
          <Send size={18} />
        </motion.button>
      </div>
    </div>
  );
};

export default AdminAIConsole;

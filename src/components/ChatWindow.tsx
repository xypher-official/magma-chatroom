import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Smile, Paperclip, Phone, Video, MoreVertical, ArrowLeft, Lock, Sparkles, Image as ImageIcon, X } from "lucide-react";
import Badges from "./Badges";
import { useI18n } from "@/hooks/useI18n";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_system: boolean;
  created_at: string;
  media_url?: string | null;
  media_type?: string | null;
}

interface Profile {
  user_id: string;
  display_name: string;
  is_verified: boolean;
  is_official: boolean;
  avatar_url?: string | null;
}

interface ChatWindowProps {
  contactName: string;
  contactAvatar: string;
  contactAvatarUrl?: string | null;
  contactOnline: boolean;
  contactIsVerified?: boolean;
  contactIsOfficial?: boolean;
  contactUserId?: string;
  messages: MessageRow[];
  myUserId: string;
  profiles: Record<string, Profile>;
  readOnly?: boolean;
  onSendMessage: (text: string, mediaUrl?: string | null, mediaType?: string | null) => void;
  onBack?: () => void;
  onStartCall?: (calleeId: string, callType: "video" | "audio") => void;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const ChatWindow = ({
  contactName, contactAvatar, contactAvatarUrl, contactOnline,
  contactIsVerified, contactIsOfficial, contactUserId,
  messages, myUserId, profiles, readOnly,
  onSendMessage, onBack, onStartCall,
}: ChatWindowProps) => {
  const { t } = useI18n();
  const [input, setInput] = useState("");
  const [showAi, setShowAi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || readOnly) return;
    onSendMessage(input.trim());
    setInput("");
  };

  const generateAndSend = async () => {
    if (!aiPrompt.trim() || aiBusy) return;
    setAiBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: { prompt: aiPrompt.trim(), purpose: "chat" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      onSendMessage(`🎨 ${aiPrompt.trim()}`, data.url, "image");
      setAiPrompt(""); setShowAi(false);
    } catch (e: any) { toast.error(e.message); }
    finally { setAiBusy(false); }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <motion.div
        initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="px-4 py-3 flex items-center gap-3 border-b border-border glass-panel"
      >
        {onBack && (
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="p-1 rounded-lg hover:bg-muted text-muted-foreground md:hidden">
            <ArrowLeft size={20} />
          </motion.button>
        )}
        <div className="relative">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm overflow-hidden ${
            contactIsOfficial ? "bg-gradient-to-br from-sky-500 to-sky-700" : "magma-gradient"
          }`}>
            {contactAvatarUrl ? <img src={contactAvatarUrl} alt="" className="w-full h-full object-cover" /> : contactAvatar}
          </div>
          {contactOnline && (
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-foreground flex items-center">
            <span className="truncate">{contactName}</span>
            <Badges isVerified={contactIsVerified} isOfficial={contactIsOfficial} size={14} />
          </h3>
          <p className="text-xs text-muted-foreground">
            {contactIsOfficial ? t("chat.officialReadOnly") : (contactOnline ? t("chat.online") : t("chat.offline"))}
          </p>
        </div>
        <div className="flex gap-1">
          {!contactIsOfficial && contactUserId && onStartCall && (
            <>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                onClick={() => onStartCall(contactUserId, "audio")}
                title={t("call.audio")}
                className="p-2 rounded-lg hover:bg-primary/15 text-muted-foreground hover:text-primary transition-colors">
                <Phone size={18} />
              </motion.button>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                onClick={() => onStartCall(contactUserId, "video")}
                title={t("call.video")}
                className="p-2 rounded-lg hover:bg-primary/15 text-muted-foreground hover:text-primary transition-colors">
                <Video size={18} />
              </motion.button>
            </>
          )}
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
            <MoreVertical size={18} />
          </motion.button>
        </div>
      </motion.div>

      <div className="flex-1 overflow-y-auto scrollbar-magma p-4 space-y-3 ember-bg">
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isOwn = msg.sender_id === myUserId;
            const senderProfile = profiles[msg.sender_id];
            const hasImage = msg.media_url && msg.media_type?.startsWith("image");
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] px-3 py-2 rounded-2xl overflow-hidden ${
                    isOwn
                      ? "magma-gradient text-primary-foreground rounded-br-md magma-glow-sm"
                      : msg.is_system
                        ? "bg-gradient-to-br from-sky-500/20 to-sky-700/20 border border-sky-500/30 text-foreground rounded-bl-md"
                        : "glass-panel-strong text-foreground rounded-bl-md"
                  }`}
                >
                  {!isOwn && (
                    <p className={`text-xs font-semibold mb-1 px-1 flex items-center ${msg.is_system ? "text-sky-400" : "text-primary"}`}>
                      <span>{senderProfile?.display_name ?? "?"}</span>
                      <Badges isVerified={senderProfile?.is_verified} isOfficial={senderProfile?.is_official} size={11} />
                    </p>
                  )}
                  {hasImage && (
                    <img src={msg.media_url!} alt="" className="rounded-xl mb-1 max-h-72 w-full object-cover" loading="lazy" />
                  )}
                  {msg.content && (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words px-1">{msg.content}</p>
                  )}
                  <p className={`text-[10px] mt-1 px-1 text-right ${isOwn ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* AI image prompt */}
      <AnimatePresence>
        {showAi && !readOnly && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="px-3 pt-3 border-t border-border bg-gradient-to-r from-fuchsia-500/10 to-amber-500/10">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-amber-400" />
              <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && generateAndSend()}
                placeholder={t("ai.imagePrompt")}
                className="flex-1 px-3 py-2 rounded-xl bg-background/60 border border-border text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              <button onClick={generateAndSend} disabled={aiBusy || !aiPrompt.trim()}
                className="px-3 py-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-amber-500 text-white text-xs font-semibold disabled:opacity-50">
                {aiBusy ? "…" : t("ai.send")}
              </button>
              <button onClick={() => setShowAi(false)} className="p-2 rounded-xl hover:bg-muted text-muted-foreground">
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-3 border-t border-border glass-panel">
        {readOnly ? (
          <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
            <Lock size={14} /> {t("chat.officialNoReply")}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              onClick={() => setShowAi((v) => !v)}
              title={t("ai.generateImage")}
              className={`p-2 rounded-lg transition-colors ${showAi ? "bg-primary/20 text-primary" : "hover:bg-muted text-muted-foreground hover:text-primary"}`}>
              <ImageIcon size={20} />
            </motion.button>
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
              <Smile size={20} />
            </motion.button>
            <input
              type="text" value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={t("chat.placeholder")}
              className="flex-1 px-4 py-2.5 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-ring/30 transition-all"
            />
            <motion.button
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              onClick={handleSend} disabled={!input.trim()}
              className="p-2.5 rounded-xl magma-gradient text-primary-foreground disabled:opacity-40 magma-glow-sm transition-all"
            >
              <Send size={18} />
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatWindow;

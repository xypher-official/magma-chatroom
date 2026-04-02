import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Smile, Paperclip, Phone, Video, MoreVertical, ArrowLeft } from "lucide-react";

interface Message {
  id: string;
  text: string;
  sender: string;
  time: string;
  isOwn: boolean;
}

interface ChatWindowProps {
  contactName: string;
  contactAvatar: string;
  contactOnline: boolean;
  messages: Message[];
  onSendMessage: (text: string) => void;
  onBack?: () => void;
}

const ChatWindow = ({ contactName, contactAvatar, contactOnline, messages, onSendMessage, onBack }: ChatWindowProps) => {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput("");
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="px-4 py-3 flex items-center gap-3 border-b border-border glass-panel"
      >
        {onBack && (
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="p-1 rounded-lg hover:bg-muted text-muted-foreground md:hidden">
            <ArrowLeft size={20} />
          </motion.button>
        )}
        <div className="relative">
          <div className="w-10 h-10 rounded-full magma-gradient flex items-center justify-center text-primary-foreground font-bold text-sm">
            {contactAvatar}
          </div>
          {contactOnline && (
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
          )}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-sm text-foreground">{contactName}</h3>
          <p className="text-xs text-muted-foreground">{contactOnline ? "En línea 🟢" : "Desconectado"}</p>
        </div>
        <div className="flex gap-1">
          {[Phone, Video, MoreVertical].map((Icon, i) => (
            <motion.button key={i} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
              <Icon size={18} />
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-magma p-4 space-y-3 ember-bg">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className={`flex ${msg.isOwn ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${
                  msg.isOwn
                    ? "magma-gradient text-primary-foreground rounded-br-md magma-glow-sm"
                    : "glass-panel-strong text-foreground rounded-bl-md"
                }`}
              >
                {!msg.isOwn && (
                  <p className="text-xs font-semibold text-primary mb-1">{msg.sender}</p>
                )}
                <p className="text-sm leading-relaxed">{msg.text}</p>
                <p className={`text-[10px] mt-1 text-right ${msg.isOwn ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                  {msg.time}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border glass-panel">
        <div className="flex items-center gap-2">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
            <Smile size={20} />
          </motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
            <Paperclip size={20} />
          </motion.button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Escribe un mensaje..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-ring/30 transition-all"
          />
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-2.5 rounded-xl magma-gradient text-primary-foreground disabled:opacity-40 magma-glow-sm transition-all"
          >
            <Send size={18} />
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;

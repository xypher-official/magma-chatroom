import { motion } from "framer-motion";
import { Search, Plus, Settings, LogOut, Shield } from "lucide-react";
import magmaLogo from "@/assets/magma-logo.png";
import Badges from "./Badges";
import { useState } from "react";

export interface ContactRow {
  id: string;
  otherUserId: string;
  name: string;
  lastMessage: string;
  time: string;
  avatar: string;
  online: boolean;
  isVerified?: boolean;
  isOfficial?: boolean;
}

interface ChatSidebarProps {
  contacts: ContactRow[];
  activeContact: string | null;
  onSelectContact: (id: string) => void;
  onLogout: () => void;
  currentUser: string;
  isAdmin?: boolean;
  isVerified?: boolean;
  onOpenAdmin?: () => void;
  onNewChat?: () => void;
  onOpenSettings?: () => void;
}

const ChatSidebar = ({
  contacts, activeContact, onSelectContact, onLogout, currentUser,
  isAdmin, isVerified, onOpenAdmin, onNewChat, onOpenSettings,
}: ChatSidebarProps) => {
  const [q, setQ] = useState("");
  const filtered = contacts.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="h-full flex flex-col bg-card border-r border-border">
      <div className="p-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <img src={magmaLogo} alt="Magma" width={36} height={36} className="rounded-lg" />
          <div className="min-w-0">
            <h2 className="font-bold text-sm magma-gradient-text">Magma Chat</h2>
            <p className="text-xs text-muted-foreground truncate flex items-center">
              <span className="truncate">{currentUser}</span>
              <Badges isAdmin={isAdmin} isVerified={isVerified} size={12} />
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          {isAdmin && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onOpenAdmin}
              title="Panel de Admin"
              className="p-2 rounded-lg hover:bg-amber-500/20 transition-colors text-amber-400"
            >
              <Shield size={18} />
            </motion.button>
          )}
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onNewChat} title="Nuevo chat" className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <Plus size={18} />
          </motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onOpenSettings} title="Ajustes" className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <Settings size={18} />
          </motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onLogout} className="p-2 rounded-lg hover:bg-destructive/20 transition-colors text-muted-foreground hover:text-destructive">
            <LogOut size={18} />
          </motion.button>
        </div>
      </div>

      <div className="p-3">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted">
          <Search size={16} className="text-muted-foreground" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar chats..."
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground flex-1 outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-magma">
        {filtered.length === 0 && (
          <p className="text-center text-xs text-muted-foreground p-6">No hay chats todavía 🔥</p>
        )}
        {filtered.map((contact, i) => (
          <motion.button
            key={contact.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => onSelectContact(contact.id)}
            className={`w-full flex items-center gap-3 p-3 mx-2 rounded-xl transition-all duration-200 ${
              activeContact === contact.id
                ? "bg-primary/15 border border-primary/20"
                : "hover:bg-muted border border-transparent"
            }`}
          >
            <div className="relative">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm ${
                contact.isOfficial ? "bg-gradient-to-br from-sky-500 to-sky-700" : "magma-gradient"
              }`}>
                {contact.avatar}
              </div>
              {contact.online && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-card" />
              )}
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="flex justify-between items-center">
                <span className="font-medium text-sm text-foreground flex items-center min-w-0">
                  <span className="truncate">{contact.name}</span>
                  <Badges isVerified={contact.isVerified} isOfficial={contact.isOfficial} size={13} />
                </span>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">{contact.time}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{contact.lastMessage}</p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default ChatSidebar;

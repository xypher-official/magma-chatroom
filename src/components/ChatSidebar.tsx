import { motion } from "framer-motion";
import { Search, Plus, Settings, LogOut } from "lucide-react";
import magmaLogo from "@/assets/magma-logo.png";

interface Contact {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unread: number;
  avatar: string;
  online: boolean;
}

interface ChatSidebarProps {
  contacts: Contact[];
  activeContact: string | null;
  onSelectContact: (id: string) => void;
  onLogout: () => void;
  currentUser: string;
}

const ChatSidebar = ({ contacts, activeContact, onSelectContact, onLogout, currentUser }: ChatSidebarProps) => {
  return (
    <div className="h-full flex flex-col bg-card border-r border-border">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-3">
          <img src={magmaLogo} alt="Magma" width={36} height={36} className="rounded-lg" />
          <div>
            <h2 className="font-bold text-sm magma-gradient-text">Magma Chat</h2>
            <p className="text-xs text-muted-foreground">{currentUser}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <Plus size={18} />
          </motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <Settings size={18} />
          </motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onLogout} className="p-2 rounded-lg hover:bg-destructive/20 transition-colors text-muted-foreground hover:text-destructive">
            <LogOut size={18} />
          </motion.button>
        </div>
      </div>

      {/* Search */}
      <div className="p-3">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted">
          <Search size={16} className="text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar chats..."
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground flex-1 outline-none"
          />
        </div>
      </div>

      {/* Contacts */}
      <div className="flex-1 overflow-y-auto scrollbar-magma">
        {contacts.map((contact, i) => (
          <motion.button
            key={contact.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => onSelectContact(contact.id)}
            className={`w-full flex items-center gap-3 p-3 mx-2 rounded-xl transition-all duration-200 ${
              activeContact === contact.id
                ? "bg-primary/15 border border-primary/20"
                : "hover:bg-muted border border-transparent"
            }`}
          >
            <div className="relative">
              <div className="w-11 h-11 rounded-full magma-gradient flex items-center justify-center text-primary-foreground font-bold text-sm">
                {contact.avatar}
              </div>
              {contact.online && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-card" />
              )}
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="flex justify-between items-center">
                <span className="font-medium text-sm text-foreground">{contact.name}</span>
                <span className="text-xs text-muted-foreground">{contact.time}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{contact.lastMessage}</p>
            </div>
            {contact.unread > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-5 h-5 rounded-full magma-gradient flex items-center justify-center text-[10px] font-bold text-primary-foreground"
              >
                {contact.unread}
              </motion.div>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default ChatSidebar;
